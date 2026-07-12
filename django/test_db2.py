import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aarx.settings')
django.setup()

from prescription.models import Prescription, Store
from django.db.models import Q
from datetime import datetime, timedelta
from django.utils import timezone

store = Store.objects.first()
rx = Prescription.objects.order_by('-uploaded_at').first()

qs = Prescription.objects.filter(
    Q(latitude__isnull=False) & 
    Q(longitude__isnull=False) &
    Q(uploaded_at__gte=store.created_at)
).filter(geohash__startswith=store.geohash[:4]).filter(location__distance_lte=(store.location, 15000))

print(f"Is Rx in filtered QS? {qs.filter(id=rx.id).exists()}")

# Let's check dates
today = timezone.localtime(timezone.now(), timezone.get_current_timezone()).date()
from prescription.views import get_local_day_bounds
start_datetime, end_datetime = get_local_day_bounds(today, today)
print(f"Uploaded: {rx.uploaded_at}")
print(f"Start: {start_datetime}")
print(f"End: {end_datetime}")
print(f"Is Rx inside dates? {start_datetime <= rx.uploaded_at < end_datetime}")

