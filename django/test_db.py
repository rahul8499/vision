import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aarx.settings')
django.setup()

from prescription.models import Prescription, Store
from django.utils import timezone
from django.contrib.gis.measure import D
from django.contrib.gis.db.models.functions import Distance

store = Store.objects.first() # assume there is a store
print(f"Store: {store.name}, Lat: {store.latitude}, Lon: {store.longitude}, Geohash: {store.geohash}")

rx = Prescription.objects.order_by('-uploaded_at').first()
print(f"Latest Rx: ID: {rx.id}, User: {rx.user.name}, Lat: {rx.latitude}, Lon: {rx.longitude}, Geohash: {rx.geohash}")
print(f"Uploaded: {rx.uploaded_at}")

if store.location and rx.location:
    dist = rx.location.distance(store.location) * 100000 # rough meters
    print(f"Distance between them: ~{dist} meters")

    rx_qs = Prescription.objects.filter(id=rx.id).annotate(d=Distance('location', store.location))
    print(f"PostGIS distance: {rx_qs.first().d.m} meters")
