import os
import django
import random
from django.contrib.gis.geos import Point

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aarx.settings')
django.setup()

from prescription.models import Store, User, Prescription

def seed_data(count=500): # Reducing to 500 each for faster testing
    print(f"🚜 Seeding {count} stores and {count} prescriptions...")
    
    base_lat = 18.5204
    base_lon = 73.8567

    user_obj = User.objects.first()
    if not user_obj:
        print("❌ No user found.")
        return

    stores = []
    prescriptions = []

    for i in range(count):
        lat = base_lat + random.uniform(-0.3, 0.3)
        lon = base_lon + random.uniform(-0.3, 0.3)
        
        # Unique email and mobile
        unique_id = random.randint(100000, 999999) + i
        stores.append(Store(
            name=f"Bench Store {i}_{unique_id}",
            mobile=f"91{unique_id:08d}",
            email=f"store_{unique_id}@bench.com",
            password="pass",
            address="Benchmark St",
            latitude=lat,
            longitude=lon
        ))
        
        prescriptions.append(Prescription(
            user=user_obj,
            image="benchmark.jpg",
            latitude=lat,
            longitude=lon,
            user_address="User benchmark addr"
        ))

    Store.objects.bulk_create(stores)
    Prescription.objects.bulk_create(prescriptions)
    
    print(f"✅ Successfully seeded {count*2} spatial records!")

if __name__ == "__main__":
    seed_data(500)
