import os
import io
from decimal import Decimal
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.db.models import Sum, Count, Q
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .authentication import StoreTokenAuthentication
from .models import (
    PrescriptionResponse,
    PrescriptionTargetStore,
    OrderReplacementRequest,
    StoreReportNote,
    ReportNote,
    SafetyReport,
    PrescriptionResponseMedicine,
)

# Timezone Utilities
LOCAL_DATE_TZ = ZoneInfo("Asia/Kolkata")

def get_local_day_bounds(start_date, end_date):
    start_datetime = datetime.combine(start_date, datetime.min.time(), tzinfo=LOCAL_DATE_TZ)
    end_datetime = datetime.combine(end_date + timedelta(days=1), datetime.min.time(), tzinfo=LOCAL_DATE_TZ)
    return start_datetime, end_datetime

# Logo Resolver
LOGO_CANDIDATE_PATHS = [
    '/home/rahulkolhe/Desktop/backup/vision/AARXUI/assets/images/aarxcolorthemelogo.png',
    os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../AARXUI/assets/images/aarxcolorthemelogo.png')),
    os.path.abspath(os.path.join(os.path.dirname(__file__), '../../AARXUI/assets/images/aarxcolorthemelogo.png')),
]
LOGO_PATH = next((p for p in LOGO_CANDIDATE_PATHS if os.path.exists(p)), None)

# ReportLab imports
from reportlab.lib.pagesizes import A4
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, Image, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.graphics.shapes import Drawing, String, Rect, Circle
from reportlab.graphics.charts.piecharts import Pie


def make_donut_chart(data_dict, colors_list, title="Revenue Split", width=210, height=85):
    d = Drawing(width, height)
    # Title
    d.add(String(105, height - 8, title, fontName="Helvetica-Bold", fontSize=9.5, textAnchor="middle", fillColor=colors.HexColor("#0F172A")))
    
    pc = Pie()
    pc.x = 5
    pc.y = 2
    pc.width = 66
    pc.height = 66
    pc.data = list(data_dict.values())
    pc.labels = []
    for i, color in enumerate(colors_list):
        if i < len(pc.slices):
            pc.slices[i].fillColor = color
            pc.slices[i].strokeColor = colors.white
            pc.slices[i].strokeWidth = 1.5
    d.add(pc)
    
    # Donut hole
    hole = Circle(38, 35, 17)
    hole.fillColor = colors.white
    hole.strokeColor = colors.white
    d.add(hole)
    
    # Legend
    y_pos = height - 22
    for (label, val), color in zip(data_dict.items(), colors_list):
        d.add(Rect(90, y_pos - 3, 6, 6, fillColor=color, strokeColor=color))
        d.add(String(100, y_pos - 2, str(label), fontName="Helvetica", fontSize=8, fillColor=colors.HexColor("#475569")))
        d.add(String(205, y_pos - 2, f"{val}%", fontName="Helvetica-Bold", fontSize=8, textAnchor="end", fillColor=colors.HexColor("#0F172A")))
        y_pos -= 13
        
    return d


def make_category_bars(categories, title="Top Categories", width=210, height=85):
    d = Drawing(width, height)
    d.add(String(105, height - 8, title, fontName="Helvetica-Bold", fontSize=9.5, textAnchor="middle", fillColor=colors.HexColor("#0F172A")))
    
    y_pos = height - 22
    for cat_name, pct in categories:
        d.add(String(0, y_pos, str(cat_name)[:16], fontName="Helvetica", fontSize=8, fillColor=colors.HexColor("#475569")))
        d.add(String(205, y_pos, f"{pct}%", fontName="Helvetica-Bold", fontSize=8, textAnchor="end", fillColor=colors.HexColor("#0F172A")))
        
        # Track background
        d.add(Rect(75, y_pos - 2, 95, 4, fillColor=colors.HexColor("#E2E8F0"), strokeColor=colors.HexColor("#E2E8F0"), rx=2, ry=2))
        # Fill bar
        bar_w = max(2, (pct / 100.0) * 95)
        d.add(Rect(75, y_pos - 2, bar_w, 4, fillColor=colors.HexColor("#00695C"), strokeColor=colors.HexColor("#00695C"), rx=2, ry=2))
        
        y_pos -= 13
    return d


def fetch_store_report_dataset(store, start_date_str=None, end_date_str=None):
    now = timezone.now()
    today = timezone.localtime(now, LOCAL_DATE_TZ).date()

    if start_date_str and end_date_str:
        s_date = parse_date(start_date_str) or (today - timedelta(days=29))
        e_date = parse_date(end_date_str) or today
    else:
        s_date = today - timedelta(days=29)
        e_date = today

    if s_date > e_date:
        s_date, e_date = e_date, s_date

    start_datetime, end_datetime = get_local_day_bounds(s_date, e_date)
    base_responses = PrescriptionResponse.objects.filter(store=store)

    # 1. Orders completed in period
    completed_qs = base_responses.filter(
        user_status='completed',
        completed_at__gte=start_datetime,
        completed_at__lt=end_datetime
    )
    completed_count = completed_qs.count()

    # 2. Orders cancelled in period
    cancelled_qs = base_responses.filter(
        user_status='cancelled',
        updated_at__gte=start_datetime,
        updated_at__lt=end_datetime
    )
    cancelled_count = cancelled_qs.count()

    # 3. Orders active / pending in period
    active_count = base_responses.filter(
        created_at__gte=start_datetime,
        created_at__lt=end_datetime
    ).exclude(
        user_status__in=['completed', 'cancelled', 'expired', 'dismissed', 'rejected']
    ).count()

    # Revenue metrics (Strictly from DB)
    gross_revenue = completed_qs.aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')
    cancelled_revenue_lost = cancelled_qs.aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')

    avg_order_value = (gross_revenue / completed_count) if completed_count > 0 else Decimal('0.00')
    estimated_payout = gross_revenue * Decimal('0.95')

    total_handled = completed_count + cancelled_count
    fulfillment_rate = round((completed_count / total_handled * 100), 1) if total_handled > 0 else 0.0

    # 4. Enquiries Received (Prescription Targets)
    total_enquiries = PrescriptionTargetStore.objects.filter(
        store=store,
        notified_at__gte=start_datetime,
        notified_at__lt=end_datetime
    ).count()

    # 5. Quotes Sent
    quotes_sent = base_responses.filter(
        created_at__gte=start_datetime,
        created_at__lt=end_datetime
    ).count()

    quote_conversion_rate = round((completed_count / quotes_sent * 100), 1) if quotes_sent > 0 else 0.0

    # 6. Replacement Requests
    replacement_qs = OrderReplacementRequest.objects.filter(
        store=store,
        created_at__gte=start_datetime,
        created_at__lt=end_datetime
    )
    total_replacements = replacement_qs.count()
    approved_replacements = replacement_qs.filter(status__in=['approved', 'in_transit', 'completed']).count()

    # 7. Complaints & Safety Reports
    store_reports_count = StoreReportNote.objects.filter(
        store=store,
        created_at__gte=start_datetime,
        created_at__lt=end_datetime
    ).count()
    user_reports_count = ReportNote.objects.filter(
        response__store=store,
        created_at__gte=start_datetime,
        created_at__lt=end_datetime
    ).count()
    safety_reports_count = SafetyReport.objects.filter(
        Q(reporter_store=store) | Q(reported_store=store),
        created_at__gte=start_datetime,
        created_at__lt=end_datetime
    ).count()
    total_issues = store_reports_count + user_reports_count + safety_reports_count

    # 8. Top Selling Medicines (Dynamic DB query with price fallback)
    top_meds_qs = PrescriptionResponseMedicine.objects.filter(
        response__in=completed_qs
    ).values('medicine_name', 'medicine_brand', 'price').annotate(
        total_qty=Count('id'),
        sum_sales=Sum('price')
    ).order_by('-total_qty')[:5]

    avg_item_price = (float(gross_revenue) / max(1, completed_count * 2)) if completed_count > 0 else 0.0

    top_medicines = []
    for item in top_meds_qs:
        qty = item['total_qty'] or 1
        raw_sales = float(item['sum_sales'] or 0.0)
        unit_price = float(item['price'] or 0.0)
        
        if raw_sales > 0:
            sales_val = raw_sales
        elif unit_price > 0:
            sales_val = unit_price * qty
        elif avg_item_price > 0:
            sales_val = avg_item_price * qty
        else:
            sales_val = 0.0

        top_medicines.append({
            'name': item['medicine_name'] or 'Medicine Item',
            'category': item['medicine_brand'] or 'General Health',
            'qty': qty,
            'sales': sales_val
        })

    if not top_medicines:
        top_medicines = [{
            'name': 'No medicine sales recorded for this period',
            'category': 'N/A',
            'qty': 0,
            'sales': 0.0
        }]

    # 9. Top Categories (Dynamic DB calculation with brand/type grouping)
    cat_qs = PrescriptionResponseMedicine.objects.filter(
        response__in=completed_qs
    ).values('medicine_brand', 'medicine_type').annotate(
        total_qty=Count('id'),
        sum_sales=Sum('price')
    ).order_by('-total_qty')[:5]

    total_med_items = PrescriptionResponseMedicine.objects.filter(response__in=completed_qs).count()
    top_categories = []

    if cat_qs and total_med_items > 0:
        for item in cat_qs:
            brand_name = item['medicine_brand'] or (item['medicine_type'].title() if item.get('medicine_type') else 'General Health')
            c_qty = item['total_qty'] or 1
            pct = round((c_qty / float(total_med_items)) * 100, 1)
            top_categories.append((brand_name, pct))

    if not top_categories:
        top_categories = [('General Health', 0.0)]

    period_days = (e_date - s_date).days + 1
    period_label = f"{s_date.strftime('%d %b %Y')} to {e_date.strftime('%d %b %Y')} ({period_days} Days)"
    generated_at_str = timezone.localtime(now, LOCAL_DATE_TZ).strftime('%d %b %Y, %I:%M %p')
    report_id_str = f"DOC-{s_date.strftime('%Y%m%d')}-WA0000{store.id}"

    # Operations percentages (Calculated dynamically)
    total_ops_vol = completed_count + cancelled_count + active_count + total_enquiries + quotes_sent + total_replacements + total_issues
    ops_denom = max(1, total_ops_vol)

    completed_pct = round((completed_count / ops_denom) * 100, 1) if total_ops_vol > 0 else 0.0
    cancelled_pct = round((cancelled_count / ops_denom) * 100, 1) if total_ops_vol > 0 else 0.0
    active_pct = round((active_count / ops_denom) * 100, 1) if total_ops_vol > 0 else 0.0
    enquiries_pct = round((total_enquiries / ops_denom) * 100, 1) if total_ops_vol > 0 else 0.0
    quotes_pct = round((quotes_sent / ops_denom) * 100, 1) if total_ops_vol > 0 else 0.0
    replacements_pct = round((total_replacements / ops_denom) * 100, 1) if total_ops_vol > 0 else 0.0
    issues_pct = round((total_issues / ops_denom) * 100, 1) if total_ops_vol > 0 else 0.0

    # Revenue split
    total_rev_sum = float(gross_revenue + cancelled_revenue_lost)
    net_payout_pct = round((float(gross_revenue) / total_rev_sum * 100), 1) if total_rev_sum > 0 else 100.0
    lost_rev_pct = round((float(cancelled_revenue_lost) / total_rev_sum * 100), 1) if total_rev_sum > 0 else 0.0

    # Dynamic Insights (100% based on DB)
    highlights = [
        f"Order fulfillment success rate: {fulfillment_rate}% across {total_handled} handled orders.",
        f"Gross Revenue generated: ₹{gross_revenue:,.2f} with estimated net payout of ₹{estimated_payout:,.2f}.",
    ]
    if cancelled_count > 0:
        highlights.append(f"Recorded {cancelled_count} cancelled orders with ₹{cancelled_revenue_lost:,.2f} lost revenue.")
    else:
        highlights.append("Zero order cancellations recorded in this reporting window.")

    recommendations = [
        f"Received {total_enquiries} prescription enquiries and issued {quotes_sent} quotes ({quote_conversion_rate}% conversion).",
        f"Handled {total_replacements} replacement requests and {total_issues} safety/support complaints.",
    ]
    if quotes_sent == 0:
        recommendations.append("Respond to incoming prescription enquiries promptly to generate sales.")
    if total_issues > 0:
        recommendations.append("Review safety & complaint reports to maintain verified store rating.")

    store_rating_val = float(getattr(store, 'rating', 5.0) or 5.0)

    return {
        'period': {
            'start_date': s_date.isoformat(),
            'end_date': e_date.isoformat(),
            'period_days': period_days,
            'period_label': period_label,
            'generated_at': generated_at_str,
            'report_id': report_id_str,
        },
        'store': {
            'id': store.id,
            'name': str(getattr(store, 'name', '') or 'Pharmacy Store'),
            'owner_name': str(getattr(store, 'owner_name', '') or 'Owner'),
            'mobile': str(getattr(store, 'mobile', '') or 'N/A'),
            'address': str(getattr(store, 'address', '') or 'Store Address'),
            'pincode': str(getattr(store, 'pincode', '') or ''),
            'gst_number': str(getattr(store, 'gst_number', '') or 'N/A'),
            'drug_license_number': str(getattr(store, 'drug_license_number', '') or 'N/A'),
            'is_verified': bool(getattr(store, 'is_verified', False)),
            'rating': store_rating_val,
        },
        'summary_cards': {
            'sales_val': float(gross_revenue),
            'total_orders': total_handled,
            'fulfillment_rate': fulfillment_rate,
            'customer_rating': store_rating_val,
            'sales_sub': f"Completed: {completed_count}",
            'orders_sub': f"Handled: {total_handled}",
            'fulfillment_sub': f"{completed_count}/{total_handled} Delivered",
            'rating_sub': "Verified Partner Status" if getattr(store, 'is_verified', False) else "Active Partner Status",
        },
        'financials': {
            'gross_revenue': float(gross_revenue),
            'avg_order_value': float(avg_order_value),
            'cancelled_revenue_lost': float(cancelled_revenue_lost),
            'estimated_payout': float(estimated_payout),
        },
        'revenue_split': {
            'Net Payout': net_payout_pct,
            'Lost Revenue': lost_rev_pct,
        },
        'operations': [
            {'status': 'Order Fulfilled', 'desc': 'Completed Orders Delivered', 'orders': completed_count, 'pct': completed_pct},
            {'status': 'Order Cancelled', 'desc': 'Cancelled Orders', 'orders': cancelled_count, 'pct': cancelled_pct},
            {'status': 'Order Pending', 'desc': 'Currently Ongoing / Active', 'orders': active_count, 'pct': active_pct},
            {'status': 'Prescription Queries', 'desc': 'Prescription Enquiries Received', 'orders': total_enquiries, 'pct': enquiries_pct},
            {'status': 'Quotes Sent', 'desc': 'Prescription Quotes Issued', 'orders': quotes_sent, 'pct': quotes_pct},
            {'status': 'Replacement Requests', 'desc': 'Medicine Replacements Requested', 'orders': total_replacements, 'pct': replacements_pct},
            {'status': 'Complaints & Safety', 'desc': 'Store/User Reports & Escalations', 'orders': total_issues, 'pct': issues_pct},
        ],
        'order_status_overview': {
            'Fulfilled': completed_pct,
            'Cancelled': cancelled_pct,
            'Pending': active_pct,
            'Queries/Quotes': round(enquiries_pct + quotes_pct, 1),
            'Disputes/Safety': round(replacements_pct + issues_pct, 1),
        },
        'top_medicines': top_medicines,
        'top_categories': top_categories,
        'highlights': highlights,
        'recommendations': recommendations,
    }


def generate_seller_business_report_pdf(data):
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=18,
        leftMargin=18,
        topMargin=18,
        bottomMargin=18
    )

    styles = getSampleStyleSheet()

    # Enterprise Executive Navy / Teal Color Palette
    COLOR_NAVY_DARK = colors.HexColor('#0A2540')
    COLOR_TEAL_ACCENT = colors.HexColor('#0F8B8D')
    COLOR_BG_LIGHT = colors.HexColor('#F8FAFC')
    COLOR_BORDER_SLATE = colors.HexColor('#CBD5E1')
    COLOR_BORDER_SOFT = colors.HexColor('#E2E8F0')
    COLOR_TEXT_MAIN = colors.HexColor('#0F172A')
    COLOR_TEXT_MUTED = colors.HexColor('#64748B')
    COLOR_GREEN_VAL = colors.HexColor('#10B981')
    COLOR_RED_VAL = colors.HexColor('#EF4444')

    # Enterprise Typography Styles
    title_banner_style = ParagraphStyle(
        'TitleBanner',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=18,
        textColor=colors.white
    )
    banner_subtitle = ParagraphStyle(
        'BannerSub',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#38BDF8'),
        alignment=2
    )
    meta_label = ParagraphStyle(
        'MetaLbl',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=COLOR_TEXT_MUTED,
        alignment=0
    )
    meta_val = ParagraphStyle(
        'MetaVal',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=COLOR_NAVY_DARK,
        alignment=2
    )
    section_banner_style = ParagraphStyle(
        'SecBanner',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=12,
        textColor=colors.white
    )
    body_bold = ParagraphStyle(
        'BodyBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=COLOR_TEXT_MAIN
    )
    body_text = ParagraphStyle(
        'BodyText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=COLOR_TEXT_MAIN
    )
    body_muted = ParagraphStyle(
        'BodyMuted',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.8,
        leading=10,
        textColor=COLOR_TEXT_MUTED
    )
    stat_val_style = ParagraphStyle(
        'StatVal',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=16,
        textColor=COLOR_NAVY_DARK
    )
    stat_lbl_style = ParagraphStyle(
        'StatLbl',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.8,
        leading=9.5,
        textColor=COLOR_TEXT_MUTED
    )
    growth_style = ParagraphStyle(
        'Growth',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.2,
        leading=9,
        textColor=COLOR_TEAL_ACCENT
    )

    story = []

    # 1. Header Row (High-Impact Logo & Executive Metadata Box)
    period = data['period']
    store = data['store']

    meta_table_data = [
        [
            Paragraph("REPORT GENERATED", meta_label),
            Paragraph(f"<b>{period['generated_at']}</b>", meta_val)
        ],
        [
            Paragraph("REPORTING PERIOD", meta_label),
            Paragraph(f"<b>{period['period_label']}</b>", meta_val)
        ],
        [
            Paragraph("EXECUTIVE REPORT ID", meta_label),
            Paragraph(f"<b>{period['report_id']}</b>", meta_val)
        ]
    ]
    meta_table = Table(meta_table_data, colWidths=[100, 159])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), COLOR_BG_LIGHT),
        ('BOX', (0, 0), (-1, -1), 1, COLOR_BORDER_SLATE),
        ('PADDING', (0, 0), (-1, -1), 5),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))

    if LOGO_PATH:
        from reportlab.lib.utils import ImageReader
        try:
            img_reader = ImageReader(LOGO_PATH)
            orig_w, orig_h = img_reader.getSize()
            aspect = float(orig_w) / float(orig_h) if orig_h > 0 else 1.5
            target_height = 130
            target_width = target_height * aspect
            logo_img = Image(LOGO_PATH, width=target_width, height=target_height)
            logo_img.hAlign = 'LEFT'
        except Exception:
            logo_img = Image(LOGO_PATH, width=195, height=130)
    else:
        logo_img = Paragraph("<b>AARX ENTERPRISE</b><br/><font size=12 color='#0F8B8D'>PHARMACY INTELLIGENCE SYSTEM</font>", title_banner_style)

    header_top_table = Table([[logo_img, meta_table]], colWidths=[300, 259])
    header_top_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(header_top_table)
    story.append(Spacer(1, 4))

    # Deep Navy Executive Title Banner
    banner_data = [[
        Paragraph("AARX ENTERPRISE • SELLER BUSINESS REPORT", title_banner_style),
        Paragraph("CONFIDENTIAL • LIVE DATA 🔒", banner_subtitle)
    ]]
    banner_table = Table(banner_data, colWidths=[380, 179])
    banner_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), COLOR_NAVY_DARK),
        ('PADDING', (0, 0), (-1, -1), 7),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(banner_table)
    story.append(Spacer(1, 6))

    # 2. Executive Pharmacy Credentials Container
    pharm_left = [
        Paragraph("<b>PHARMACY PARTNER</b>", body_muted),
        Paragraph(f"<b>{store['name']}</b>", ParagraphStyle('StoreName', parent=body_bold, fontSize=9, leading=11, textColor=COLOR_NAVY_DARK)),
        Spacer(1, 2),
        Paragraph("<b>REGISTERED LOCATION</b>", body_muted),
        Paragraph(f"{store['address']} - {store['pincode']}", body_text),
    ]
    pharm_right = [
        Paragraph("<b>OWNER / CONTACT</b>", body_muted),
        Paragraph(f"{store['owner_name']} ({store['mobile']})", body_bold),
        Spacer(1, 2),
        Paragraph("<b>DRUG LICENSE NO. & GSTIN</b>", body_muted),
        Paragraph(f"Lic: {store['drug_license_number']} | GST: {store['gst_number']}", body_bold),
        Spacer(1, 2),
        Paragraph("<b>PARTNER COMPLIANCE STATUS</b>", body_muted),
        Paragraph("<font color='#10B981'><b>Verified Enterprise Partner ✅</b></font>", body_bold),
    ]

    # Circular store icon badge
    icon_drawing = Drawing(38, 38)
    icon_drawing.add(Circle(19, 19, 19, fillColor=colors.HexColor("#E0F2F1"), strokeColor=colors.HexColor("#0F8B8D")))
    icon_drawing.add(String(19, 13, "🏥", fontName="Helvetica", fontSize=16, textAnchor="middle"))

    pharm_box_table = Table([[icon_drawing, pharm_left, pharm_right]], colWidths=[45, 257, 257])
    pharm_box_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), COLOR_BG_LIGHT),
        ('BOX', (0, 0), (-1, -1), 1, COLOR_BORDER_SLATE),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(pharm_box_table)
    story.append(Spacer(1, 6))

    # 3. 4 Executive KPI Stat Tiles
    cards_data = data['summary_cards']

    c1 = [
        Paragraph(f"🟢 <font size=12><b>₹{cards_data['sales_val']:,.0f}</b></font>", stat_val_style),
        Paragraph("Total Gross Sales", stat_lbl_style),
        Paragraph(f"• {cards_data['sales_sub']}", growth_style)
    ]
    c2 = [
        Paragraph(f"🔵 <font size=12><b>{cards_data['total_orders']:,}</b></font>", stat_val_style),
        Paragraph("Total Orders Handled", stat_lbl_style),
        Paragraph(f"• {cards_data['orders_sub']}", growth_style)
    ]
    c3 = [
        Paragraph(f"⚡ <font size=12><b>{cards_data['fulfillment_rate']}%</b></font>", stat_val_style),
        Paragraph("Fulfillment Efficiency", stat_lbl_style),
        Paragraph(f"• {cards_data['fulfillment_sub']}", growth_style)
    ]
    c4 = [
        Paragraph(f"⭐ <font size=12><b>{cards_data['customer_rating']}</b></font>", stat_val_style),
        Paragraph("Partner Service Rating", stat_lbl_style),
        Paragraph(f"• {cards_data['rating_sub']}", growth_style)
    ]

    stat_cards_table = Table([[c1, c2, c3, c4]], colWidths=[139.75, 139.75, 139.75, 139.75])
    stat_cards_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.white),
        ('BOX', (0, 0), (0, 0), 1, COLOR_BORDER_SOFT),
        ('BOX', (1, 0), (1, 0), 1, COLOR_BORDER_SOFT),
        ('BOX', (2, 0), (2, 0), 1, COLOR_BORDER_SOFT),
        ('BOX', (3, 0), (3, 0), 1, COLOR_BORDER_SOFT),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(stat_cards_table)
    story.append(Spacer(1, 8))

    # Section Header Builder Helper
    def create_section_header(title_text):
        tbl = Table([[Paragraph(title_text, section_banner_style)]], colWidths=[559])
        tbl.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), COLOR_NAVY_DARK),
            ('PADDING', (0, 0), (-1, -1), 4),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        return tbl

    # 4. Section 1: Financial Performance & Seller Payout
    fin = data['financials']
    rev_table_rows = [
        [Paragraph("<b>Financial Summary Indicator</b>", body_bold), Paragraph("<b>Amount (₹)</b>", ParagraphStyle('RAmount', parent=body_bold, alignment=2))],
        [Paragraph("Gross Revenue (Completed Orders)", body_text), Paragraph(f"₹ {fin['gross_revenue']:,.2f}", ParagraphStyle('RVal', parent=body_text, alignment=2))],
        [Paragraph("Average Order Value (AOV)", body_text), Paragraph(f"₹ {fin['avg_order_value']:,.2f}", ParagraphStyle('RVal', parent=body_text, alignment=2))],
        [Paragraph("Lost Revenue (Cancelled Orders)", body_text), Paragraph(f"₹ {fin['cancelled_revenue_lost']:,.2f}", ParagraphStyle('RVal', parent=body_text, alignment=2))],
        [Paragraph("<b>Estimated Net Seller Payout</b>", body_bold), Paragraph(f"<b>₹ {fin['estimated_payout']:,.2f}</b>", ParagraphStyle('RValB', parent=body_bold, alignment=2))],
    ]
    rev_table = Table(rev_table_rows, colWidths=[215, 115])
    rev_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COLOR_BG_LIGHT),
        ('GRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER_SOFT),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#ECFDF5')),
        ('PADDING', (0, 0), (-1, -1), 4),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))

    donut1 = make_donut_chart(data['revenue_split'], [COLOR_TEAL_ACCENT, COLOR_RED_VAL], title="Revenue Split (%)", width=229, height=85)

    sec1_layout = Table([[rev_table, donut1]], colWidths=[330, 229])
    sec1_layout.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 0),
    ]))

    story.append(create_section_header("SECTION 1 | FINANCIAL PERFORMANCE & SELLER PAYOUT"))
    story.append(Spacer(1, 4))
    story.append(sec1_layout)
    story.append(Spacer(1, 8))

    # 5. Section 2: Operational Summary & Lifecycle Audit
    op_rows = [
        [
            Paragraph("<b>Operational Metric</b>", body_bold),
            Paragraph("<b>Lifecycle Event Description</b>", body_bold),
            Paragraph("<b>Volume</b>", ParagraphStyle('ROrd', parent=body_bold, alignment=2)),
            Paragraph("<b>% Share</b>", ParagraphStyle('RPct', parent=body_bold, alignment=2))
        ]
    ]
    for row in data['operations']:
        op_rows.append([
            Paragraph(f"• {row['status']}", body_text),
            Paragraph(row['desc'], body_muted),
            Paragraph(f"{row['orders']:,}", ParagraphStyle('RVal', parent=body_text, alignment=2)),
            Paragraph(f"{row['pct']}%", ParagraphStyle('RVal', parent=body_text, alignment=2)),
        ])

    op_table = Table(op_rows, colWidths=[115, 135, 40, 40])
    op_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COLOR_BG_LIGHT),
        ('GRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER_SOFT),
        ('PADDING', (0, 0), (-1, -1), 3),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))

    donut2 = make_donut_chart(data['order_status_overview'], [COLOR_NAVY_DARK, colors.HexColor('#F59E0B'), COLOR_TEAL_ACCENT, colors.HexColor('#8B5CF6')], title="Order Status Overview", width=229, height=105)

    sec2_layout = Table([[op_table, donut2]], colWidths=[330, 229])
    sec2_layout.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 0),
    ]))

    story.append(create_section_header("SECTION 2 | OPERATIONAL SUMMARY & LIFECYCLE AUDIT"))
    story.append(Spacer(1, 4))
    story.append(sec2_layout)
    story.append(Spacer(1, 8))

    # 6. Section 3: Top Selling Pharmaceuticals & Demand Analysis
    med_rows = [
        [
            Paragraph("<b>#</b>", body_bold),
            Paragraph("<b>Pharmaceutical / Medicine</b>", body_bold),
            Paragraph("<b>Category / Brand</b>", body_bold),
            Paragraph("<b>Units Sold</b>", ParagraphStyle('RQty', parent=body_bold, alignment=2)),
            Paragraph("<b>Total Value (₹)</b>", ParagraphStyle('RSales', parent=body_bold, alignment=2))
        ]
    ]
    for idx, med in enumerate(data['top_medicines'], start=1):
        med_rows.append([
            Paragraph(str(idx), body_text),
            Paragraph(f"<b>{med['name']}</b>", body_text),
            Paragraph(med['category'], body_muted),
            Paragraph(str(med['qty']), ParagraphStyle('RVal', parent=body_text, alignment=2)),
            Paragraph(f"{med['sales']:,.2f}", ParagraphStyle('RVal', parent=body_text, alignment=2)),
        ])

    med_table = Table(med_rows, colWidths=[15, 130, 85, 45, 55])
    med_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COLOR_BG_LIGHT),
        ('GRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER_SOFT),
        ('PADDING', (0, 0), (-1, -1), 3),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))

    cat_bars = make_category_bars(data['top_categories'], title="Category Demand Split", width=229, height=95)

    sec3_layout = Table([[med_table, cat_bars]], colWidths=[330, 229])
    sec3_layout.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 0),
    ]))

    story.append(create_section_header("SECTION 3 | TOP SELLING PHARMACEUTICALS & DEMAND ANALYSIS"))
    story.append(Spacer(1, 4))
    story.append(sec3_layout)
    story.append(Spacer(1, 8))

    # 7. Section 4: Strategic Executive Insights & Recommendations
    highlights_content = [Paragraph("<b>Performance Highlights</b>", ParagraphStyle('HHead', parent=body_bold, textColor=COLOR_NAVY_DARK, fontSize=8.5))]
    for h in data['highlights']:
        highlights_content.append(Paragraph(f"• {h}", body_text))

    recs_content = [Paragraph("<b>Growth Recommendations</b>", ParagraphStyle('RHead', parent=body_bold, textColor=COLOR_NAVY_DARK, fontSize=8.5))]
    for r in data['recommendations']:
        recs_content.append(Paragraph(f"• {r}", body_text))

    box_left = Table([[highlights_content]], colWidths=[270])
    box_left.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), COLOR_BG_LIGHT),
        ('BOX', (0, 0), (-1, -1), 1, COLOR_BORDER_SLATE),
        ('PADDING', (0, 0), (-1, -1), 5),
    ]))

    box_right = Table([[recs_content]], colWidths=[279])
    box_right.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), COLOR_BG_LIGHT),
        ('BOX', (0, 0), (-1, -1), 1, COLOR_BORDER_SLATE),
        ('PADDING', (0, 0), (-1, -1), 5),
    ]))

    sec4_layout = Table([[box_left, box_right]], colWidths=[275, 284])
    sec4_layout.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('PADDING', (0, 0), (-1, -1), 0),
    ]))

    story.append(create_section_header("SECTION 4 | STRATEGIC EXECUTIVE INSIGHTS & RECOMMENDATIONS"))
    story.append(Spacer(1, 4))
    story.append(sec4_layout)
    story.append(Spacer(1, 8))

    # Executive Footer
    story.append(HRFlowable(width="100%", thickness=0.75, color=COLOR_NAVY_DARK, spaceBefore=2, spaceAfter=4))
    footer_table_data = [[
        Paragraph("Confidential Enterprise Document • Generated by AARX Pharmacy Intelligence System", body_muted),
        Paragraph("Page 1 of 1", ParagraphStyle('PageNum', parent=body_muted, alignment=2))
    ]]
    footer_table = Table(footer_table_data, colWidths=[430, 129])
    footer_table.setStyle(TableStyle([
        ('PADDING', (0, 0), (-1, -1), 0),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(footer_table)

    doc.build(story)
    pdf_bytes = buf.getvalue()
    buf.close()
    return pdf_bytes


class StoreBusinessReportDataView(APIView):
    authentication_classes = [StoreTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        store = request.user
        start_date_str = request.query_params.get("start_date")
        end_date_str = request.query_params.get("end_date")

        dataset = fetch_store_report_dataset(store, start_date_str, end_date_str)
        return Response(dataset)


class StoreBusinessReportPDFView(APIView):
    authentication_classes = [StoreTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        store = request.user
        start_date_str = request.query_params.get("start_date")
        end_date_str = request.query_params.get("end_date")

        dataset = fetch_store_report_dataset(store, start_date_str, end_date_str)
        pdf_bytes = generate_seller_business_report_pdf(dataset)

        filename = f"AARX_Seller_Report_{dataset['period']['start_date']}_to_{dataset['period']['end_date']}.pdf"
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
