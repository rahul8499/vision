import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aarx.settings')
django.setup()

from prescription.models import User, Store, Prescription, PrescriptionResponse
from django.contrib.gis.geos import Point

store = Store.objects.first()
buyer = User.objects.exclude(id=store.id).first() if store else User.objects.first()

if store and buyer:
    p1 = Prescription.objects.create(
        user=buyer,
        location=Point(77.5946, 12.9716),
        status="active"
    )
    p2 = Prescription.objects.create(
        user=buyer,
        location=Point(77.5946, 12.9716),
        status="active"
    )
    
    r1 = PrescriptionResponse.objects.create(
        prescription=p1,
        store=store,
        user=buyer,
        response_text="Available",
        total_amount=150.00,
        store_name=store.name if hasattr(store, 'name') else "Test Store",
        user_status='accepted',
        is_processing_started=False,
        is_packed=False,
        is_locked=False,
        quotation_scenario='all_generic'
    )
    r2 = PrescriptionResponse.objects.create(
        prescription=p2,
        store=store,
        user=buyer,
        response_text="Available",
        total_amount=250.00,
        store_name=store.name if hasattr(store, 'name') else "Test Store",
        user_status='accepted',
        is_processing_started=False,
        is_packed=False,
        is_locked=False,
        quotation_scenario='exact_brand'
    )
    print("Seeded 2 responses in 'accepted' status!")
else:
    print("Could not find store or buyer")
