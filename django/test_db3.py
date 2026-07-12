import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aarx.settings')
django.setup()

from prescription.models import Prescription, Store, PrescriptionTargetStore, PrescriptionResponse, ChatThread, ReportNote, StoreReportNote
from django.db.models import Q, Exists, OuterRef, Subquery, IntegerField, Count
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.measure import D
from datetime import datetime, timedelta
from django.utils import timezone
from prescription.views import get_local_day_bounds

store = Store.objects.first()

target_ids = list(PrescriptionTargetStore.objects.filter(store=store).values_list('prescription_id', flat=True))

prescriptions = Prescription.objects.filter(
    Q(id__in=target_ids) |
    (
        Q(latitude__isnull=False) & 
        Q(longitude__isnull=False) &
        Q(uploaded_at__gte=store.created_at)
    )
).order_by('-uploaded_at')

today = timezone.localtime(timezone.now(), timezone.get_current_timezone()).date()
start_datetime, end_datetime = get_local_day_bounds(today, today)
prescriptions = prescriptions.filter(uploaded_at__gte=start_datetime, uploaded_at__lt=end_datetime)

prescriptions = prescriptions.filter(
    Q(id__in=target_ids) |
    Q(geohash__startswith=store.geohash[:4])
)

prescriptions = prescriptions.annotate(
    distance=Distance('location', store.location)
)

res_qs = PrescriptionResponse.objects.filter(prescription=OuterRef('pk'), store=store)
thr_qs = ChatThread.objects.filter(prescription=OuterRef('pk'), store=store).values('id')[:1]

prescriptions = prescriptions.annotate(
    has_responded=Exists(res_qs),
    response_id=Subquery(res_qs.values('id')[:1]),
).filter(
    Q(id__in=target_ids) | 
    Q(location__distance_lte=(store.location, 15000))
).distinct().select_related('user')

seen_ids = set()
results = []
for p in prescriptions:
    if p.id not in seen_ids:
        seen_ids.add(p.id)
        results.append(p)

for p in results:
    p.store_lat = store.latitude
    p.store_lon = store.longitude
    p.store_address = store.address
    p.distance_km_val = p.distance.km if p.distance else 999
    
results.sort(key=lambda p: (p.status != 'emergency', -p.uploaded_at.timestamp(), p.distance_km_val))

print(f"Total results: {len(results)}")
if results:
    print(f"Top result: {results[0].id}, {results[0].user.name}")
