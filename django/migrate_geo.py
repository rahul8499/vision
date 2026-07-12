import os
import django
from django.contrib.gis.geos import Point

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aarx.settings')
django.setup()

from prescription.models import Store, Prescription

def migrate_data():
    print("Migrating Store locations...")
    stores = Store.objects.filter(latitude__isnull=False, longitude__isnull=False)
    for store in stores:
        store.location = Point(float(store.longitude), float(store.latitude))
        store.save()
    print(f"Updated {stores.count()} stores.")

    print("Migrating Prescription locations...")
    prescriptions = Prescription.objects.filter(latitude__isnull=False, longitude__isnull=False)
    for p in prescriptions:
        p.location = Point(float(p.longitude), float(p.latitude))
        p.save()
    print(f"Updated {prescriptions.count()} prescriptions.")

if __name__ == "__main__":
    migrate_data()
