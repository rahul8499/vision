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

# ReportLab imports
from reportlab.lib.pagesizes import A4
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors


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

    # Orders completed in period
    completed_qs = base_responses.filter(
        user_status='completed',
        completed_at__gte=start_datetime,
        completed_at__lt=end_datetime
    )
    completed_count = completed_qs.count()

    # Orders cancelled in period
    cancelled_qs = base_responses.filter(
        user_status='cancelled',
        updated_at__gte=start_datetime,
        updated_at__lt=end_datetime
    )
    cancelled_count = cancelled_qs.count()

    # Orders accepted / in-progress in period
    accepted_qs = base_responses.filter(
        accepted_at__gte=start_datetime,
        accepted_at__lt=end_datetime
    )
    accepted_count = accepted_qs.count()

    active_count = base_responses.filter(
        created_at__gte=start_datetime,
        created_at__lt=end_datetime
    ).exclude(
        user_status__in=['completed', 'cancelled', 'expired', 'dismissed', 'rejected']
    ).count()

    # Revenue metrics
    gross_revenue = completed_qs.aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')
    cancelled_revenue_lost = cancelled_qs.aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')

    avg_order_value = (gross_revenue / completed_count) if completed_count > 0 else Decimal('0.00')
    # Estimated net payout (~95% after estimated 5% platform/service fee)
    estimated_payout = gross_revenue * Decimal('0.95')

    total_handled = completed_count + cancelled_count
    fulfillment_rate = round((completed_count / total_handled * 100), 1) if total_handled > 0 else 100.0

    # Enquiries / Quotes
    total_enquiries = PrescriptionTargetStore.objects.filter(
        store=store,
        notified_at__gte=start_datetime,
        notified_at__lt=end_datetime
    ).count()

    quotes_sent = base_responses.filter(
        created_at__gte=start_datetime,
        created_at__lt=end_datetime
    ).count()

    quote_conversion_rate = round((completed_count / quotes_sent * 100), 1) if quotes_sent > 0 else 0.0

    # Replacements
    replacement_qs = OrderReplacementRequest.objects.filter(
        store=store,
        created_at__gte=start_datetime,
        created_at__lt=end_datetime
    )
    total_replacements = replacement_qs.count()
    approved_replacements = replacement_qs.filter(status__in=['approved', 'in_transit', 'completed']).count()
    completed_replacements = replacement_qs.filter(status='completed').count()
    rejected_replacements = replacement_qs.filter(status='rejected').count()

    # Complaints & Safety Reports
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

    # Top Selling Medicines
    top_meds_qs = PrescriptionResponseMedicine.objects.filter(
        response__in=completed_qs,
        is_available=True
    ).values('medicine_name', 'medicine_brand').annotate(
        total_qty=Count('id'),
        total_sales=Sum('price')
    ).order_by('-total_sales')[:10]

    top_medicines = []
    for item in top_meds_qs:
        top_medicines.append({
            'name': item['medicine_name'] or 'Medicine Item',
            'brand': item['medicine_brand'] or 'Standard Brand',
            'qty': item['total_qty'],
            'revenue': float(item['total_sales'] or Decimal('0.00'))
        })

    # Period summary text
    period_days = (e_date - s_date).days + 1
    period_label = f"{s_date.strftime('%b %d, %Y')} to {e_date.strftime('%b %d, %Y')} ({period_days} Days)"

    # Executive Insights
    insights = [
        f"Generated Gross Revenue of ₹{gross_revenue:,.2f} across {completed_count} completed orders.",
        f"Maintained an order fulfillment success rate of {fulfillment_rate}%.",
    ]
    if cancelled_count > 0:
        insights.append(f"Cancellations impacted revenue by ₹{cancelled_revenue_lost:,.2f} across {cancelled_count} orders.")
    else:
        insights.append("Zero order cancellations recorded in this period! Excellent operational reliability.")

    if quote_conversion_rate > 50:
        insights.append(f"Strong quote conversion rate of {quote_conversion_rate}% on prescription quotes sent.")
    else:
        insights.append(f"Opportunity to increase quote conversion (currently {quote_conversion_rate}%) by offering competitive pricing.")

    return {
        'period': {
            'start_date': s_date.isoformat(),
            'end_date': e_date.isoformat(),
            'period_days': period_days,
            'period_label': period_label,
            'generated_at': timezone.localtime(now).strftime('%b %d, %Y %I:%M %p')
        },
        'store': {
            'id': store.id,
            'name': getattr(store, 'name', 'Pharmacy Store'),
            'owner_name': getattr(store, 'owner_name', 'N/A'),
            'mobile': getattr(store, 'mobile', 'N/A'),
            'email': getattr(store, 'email', 'N/A'),
            'address': getattr(store, 'address', 'N/A'),
            'pincode': getattr(store, 'pincode', 'N/A'),
            'gst_number': getattr(store, 'gst_number', 'N/A'),
            'drug_license_number': getattr(store, 'drug_license_number', 'N/A'),
            'is_verified': getattr(store, 'is_verified', False),
        },
        'financials': {
            'gross_revenue': float(gross_revenue),
            'estimated_payout': float(estimated_payout),
            'avg_order_value': float(avg_order_value),
            'cancelled_revenue_lost': float(cancelled_revenue_lost),
        },
        'orders': {
            'total_received': accepted_count + active_count,
            'accepted': accepted_count,
            'completed': completed_count,
            'cancelled': cancelled_count,
            'active_in_progress': active_count,
            'fulfillment_rate': fulfillment_rate,
        },
        'enquiries': {
            'total_prescriptions_received': total_enquiries,
            'quotes_sent': quotes_sent,
            'quote_conversion_rate': quote_conversion_rate,
        },
        'replacements': {
            'total_requests': total_replacements,
            'approved': approved_replacements,
            'completed': completed_replacements,
            'rejected': rejected_replacements,
        },
        'complaints': {
            'store_reports': store_reports_count,
            'user_reports': user_reports_count,
            'safety_reports': safety_reports_count,
            'total_issues': store_reports_count + user_reports_count + safety_reports_count,
        },
        'top_medicines': top_medicines,
        'insights': insights,
    }


def generate_seller_business_report_pdf(data):
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=28,
        leftMargin=28,
        topMargin=28,
        bottomMargin=28
    )

    styles = getSampleStyleSheet()

    # Custom Color Palette (Navy & Teal Design System)
    PRIMARY_NAVY = colors.HexColor('#123B5D')
    SECONDARY_TEAL = colors.HexColor('#0F8B8D')
    BG_LIGHT = colors.HexColor('#F8FAFC')
    CARD_BG = colors.HexColor('#F1F5F9')
    BORDER_COLOR = colors.HexColor('#CBD5E1')
    TEXT_DARK = colors.HexColor('#0F172A')
    TEXT_MUTED = colors.HexColor('#475569')

    # Typography Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.white
    )
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#E2E8F0')
    )
    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=PRIMARY_NAVY,
        spaceAfter=6
    )
    body_bold = ParagraphStyle(
        'BodyBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=TEXT_DARK
    )
    body_text = ParagraphStyle(
        'BodyTextCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=TEXT_DARK
    )
    body_muted = ParagraphStyle(
        'BodyMuted',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=TEXT_MUTED
    )
    card_value_style = ParagraphStyle(
        'CardVal',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=17,
        textColor=PRIMARY_NAVY,
        alignment=1
    )
    card_label_style = ParagraphStyle(
        'CardLbl',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=TEXT_MUTED,
        alignment=1
    )

    story = []

    # 1. Header Banner
    header_data = [
        [
            Paragraph("AARX HEALTHCARE NETWORK", subtitle_style),
            Paragraph(f"Generated: {data['period']['generated_at']}", ParagraphStyle('HeadRight', parent=subtitle_style, alignment=2))
        ],
        [
            Paragraph("STORE BUSINESS & PERFORMANCE REPORT", title_style),
            Paragraph(f"Period: {data['period']['period_label']}", ParagraphStyle('HeadRightSub', parent=subtitle_style, alignment=2))
        ]
    ]
    header_table = Table(header_data, colWidths=[330, 208])
    header_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), PRIMARY_NAVY),
        ('PADDING', (0, 0), (-1, -1), 10),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, -1), (-1, -1), 12),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 10))

    # 2. Pharmacy Details Box
    store_info = data['store']
    details_data = [
        [
            Paragraph(f"<b>Pharmacy Name:</b> {store_info['name']}", body_text),
            Paragraph(f"<b>Owner / Contact:</b> {store_info['owner_name']} ({store_info['mobile']})", body_text),
        ],
        [
            Paragraph(f"<b>GST Number:</b> {store_info['gst_number']}", body_text),
            Paragraph(f"<b>Drug License:</b> {store_info['drug_license_number']}", body_text),
        ],
        [
            Paragraph(f"<b>Address:</b> {store_info['address']} - {store_info['pincode']}", body_text),
            Paragraph(f"<b>Verification Status:</b> {'Verified Partner ✅' if store_info['is_verified'] else 'Active Store'}", body_text),
        ]
    ]
    details_table = Table(details_data, colWidths=[269, 269])
    details_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BG_LIGHT),
        ('BOX', (0, 0), (-1, -1), 1, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(details_table)
    story.append(Spacer(1, 12))

    # 3. Key Metrics Cards (4 Column Grid)
    fin = data['financials']
    ord_data = data['orders']

    card1 = [Paragraph(f"₹{fin['gross_revenue']:,.2f}", card_value_style), Paragraph("GROSS REVENUE", card_label_style)]
    card2 = [Paragraph(f"{ord_data['completed']}", card_value_style), Paragraph("COMPLETED ORDERS", card_label_style)]
    card3 = [Paragraph(f"{ord_data['fulfillment_rate']}%", card_value_style), Paragraph("FULFILLMENT RATE", card_label_style)]
    card4 = [Paragraph(f"₹{fin['estimated_payout']:,.2f}", card_value_style), Paragraph("ESTIMATED PAYOUT", card_label_style)]

    cards_table = Table([[card1, card2, card3, card4]], colWidths=[134, 134, 135, 135])
    cards_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), colors.HexColor('#EFF6FF')),
        ('BACKGROUND', (1, 0), (1, 0), colors.HexColor('#ECFDF5')),
        ('BACKGROUND', (2, 0), (2, 0), colors.HexColor('#F0FDFA')),
        ('BACKGROUND', (3, 0), (3, 0), colors.HexColor('#FEF3C7')),
        ('BOX', (0, 0), (0, 0), 1, colors.HexColor('#BFDBFE')),
        ('BOX', (1, 0), (1, 0), 1, colors.HexColor('#A7F3D0')),
        ('BOX', (2, 0), (2, 0), 1, colors.HexColor('#99F6E4')),
        ('BOX', (3, 0), (3, 0), 1, colors.HexColor('#FDE68A')),
        ('PADDING', (0, 0), (-1, -1), 8),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(cards_table)
    story.append(Spacer(1, 14))

    # 4. Financial & Revenue Statement
    story.append(Paragraph("1. FINANCIAL PERFORMANCE & REVENUE BREAKDOWN", section_heading))
    fin_table_data = [
        [Paragraph("<b>Financial Metric</b>", body_bold), Paragraph("<b>Amount (₹) / Details</b>", ParagraphStyle('RBold', parent=body_bold, alignment=2))],
        [Paragraph("Gross Revenue (Completed Orders)", body_text), Paragraph(f"<b>₹{fin['gross_revenue']:,.2f}</b>", ParagraphStyle('RText', parent=body_text, alignment=2))],
        [Paragraph("Average Order Value (AOV)", body_text), Paragraph(f"₹{fin['avg_order_value']:,.2f}", ParagraphStyle('RText', parent=body_text, alignment=2))],
        [Paragraph("Lost Revenue due to Cancellations", body_text), Paragraph(f"<font color='#DC2626'>- ₹{fin['cancelled_revenue_lost']:,.2f}</font>", ParagraphStyle('RText', parent=body_text, alignment=2))],
        [Paragraph("Estimated Net Seller Payout", body_bold), Paragraph(f"<font color='#059669'><b>₹{fin['estimated_payout']:,.2f}</b></font>", ParagraphStyle('RText', parent=body_bold, alignment=2))],
    ]
    fin_table = Table(fin_table_data, colWidths=[338, 200])
    fin_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), SECONDARY_TEAL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
        ('PADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(fin_table)
    story.append(Spacer(1, 14))

    # 5. Operational Summary Table (Orders, Enquiries, Replacements, Complaints)
    story.append(Paragraph("2. OPERATIONAL & ORDER LIFECYCLE SUMMARY", section_heading))
    enq = data['enquiries']
    rep = data['replacements']
    comp = data['complaints']

    op_table_data = [
        [Paragraph("<b>Category</b>", body_bold), Paragraph("<b>Metric Description</b>", body_bold), Paragraph("<b>Volume / Count</b>", ParagraphStyle('RBold', parent=body_bold, alignment=2))],
        [Paragraph("Order Fulfillment", body_text), Paragraph("Completed Orders Delivered", body_text), Paragraph(f"<b>{ord_data['completed']}</b>", ParagraphStyle('RText', parent=body_text, alignment=2))],
        [Paragraph("Order Fulfillment", body_text), Paragraph("Cancelled Orders", body_text), Paragraph(f"<font color='#DC2626'>{ord_data['cancelled']}</font>", ParagraphStyle('RText', parent=body_text, alignment=2))],
        [Paragraph("Prescriptions & Quotes", body_text), Paragraph("Prescription Enquiries Received", body_text), Paragraph(f"{enq['total_prescriptions_received']}", ParagraphStyle('RText', parent=body_text, alignment=2))],
        [Paragraph("Prescriptions & Quotes", body_text), Paragraph("Quotes Sent & Conversion %", body_text), Paragraph(f"{enq['quotes_sent']} ({enq['quote_conversion_rate']}%)", ParagraphStyle('RText', parent=body_text, alignment=2))],
        [Paragraph("Medicine Replacements", body_text), Paragraph("Replacement Requests (Approved / Rejected)", body_text), Paragraph(f"{rep['total_requests']} (Approved: {rep['approved']})", ParagraphStyle('RText', parent=body_text, alignment=2))],
        [Paragraph("Support & Disputes", body_text), Paragraph("Complaints & Safety Reports", body_text), Paragraph(f"{comp['total_issues']} Issues", ParagraphStyle('RText', parent=body_text, alignment=2))],
    ]
    op_table = Table(op_table_data, colWidths=[150, 248, 140])
    op_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY_NAVY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
        ('PADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(op_table)
    story.append(Spacer(1, 14))

    # 6. Top Selling Medicines
    top_meds = data['top_medicines']
    if top_meds:
        story.append(Paragraph("3. TOP SELLING MEDICINES & DEMAND ANALYSIS", section_heading))
        med_rows = [
            [
                Paragraph("<b>#</b>", body_bold),
                Paragraph("<b>Medicine Name</b>", body_bold),
                Paragraph("<b>Brand / Variant</b>", body_bold),
                Paragraph("<b>Orders Sold</b>", ParagraphStyle('RBold', parent=body_bold, alignment=2)),
                Paragraph("<b>Total Sales (₹)</b>", ParagraphStyle('RBold', parent=body_bold, alignment=2))
            ]
        ]
        for idx, med in enumerate(top_meds, start=1):
            med_rows.append([
                Paragraph(str(idx), body_text),
                Paragraph(f"<b>{med['name']}</b>", body_text),
                Paragraph(med['brand'], body_text),
                Paragraph(str(med['qty']), ParagraphStyle('RText', parent=body_text, alignment=2)),
                Paragraph(f"₹{med['revenue']:,.2f}", ParagraphStyle('RText', parent=body_text, alignment=2)),
            ])
        med_table = Table(med_rows, colWidths=[30, 218, 140, 70, 80])
        med_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#334155')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
            ('PADDING', (0, 0), (-1, -1), 5),
        ]))
        story.append(med_table)
        story.append(Spacer(1, 14))

    # 7. Executive Insights & Growth Recommendations ("Seller Fayda Summary")
    story.append(Paragraph("4. SELLER BUSINESS PERFORMANCE & PROFIT INSIGHTS", section_heading))
    insights_content = []
    for item in data['insights']:
        insights_content.append(Paragraph(f"• {item}", body_text))

    insights_box = Table([[insights_content]], colWidths=[538])
    insights_box.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), colors.HexColor('#F0F9FF')),
        ('BOX', (0, 0), (0, 0), 1, colors.HexColor('#0284C7')),
        ('PADDING', (0, 0), (0, 0), 8),
    ]))
    story.append(insights_box)
    story.append(Spacer(1, 14))

    # Footer note
    footer_text = Paragraph(
        "Confidential Document • Generated automatically by AARX Enterprise Platform • All financial estimates subject to terms of service.",
        body_muted
    )
    story.append(footer_text)

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
