import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aarx.settings')
django.setup()

from prescription.models import Store, Prescription

# Get latest store
store = Store.objects.order_by('-id').first()
print(f"Store: {store.name}, created_at: {store.created_at}")

# Get latest prescription
rx = Prescription.objects.order_by('-id').first()
if rx:
    print(f"Prescription: {rx.id}, uploaded_at: {rx.uploaded_at}")

