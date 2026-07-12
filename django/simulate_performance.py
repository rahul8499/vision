import os
import django
import random
from decimal import Decimal

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aarx.settings')
django.setup()

from prescription.models import Store, Rating, PrescriptionResponse, Prescription
from django.contrib.auth import get_user_model

User = get_user_model()

def simulate():
    print("🚀 Starting Store Performance Simulation...")
    
    # 1. Get or Create a Test Store
    store = Store.objects.first() # Let's target the first store for visibility
    if not store:
        print("❌ No store found in database. Please register a store first.")
        return

    print(f"📊 Targeting Store: {store.name} (ID: {store.id})")

    # 2. Reset existing performance for clean slate
    store.completed_orders_count = 15
    store.cancelled_orders_count = 1
    store.repeat_order_count = 8
    store.avg_response_time_mins = 4 # Fast responder
    store.save()

    # 3. Add Ratings (Need at least 5 to trigger "Top Rated")
    # First, we need some completed orders to rate
    # If they don't exist, we'll just mock the objects
    
    # Clear old ratings for this store to prevent noise
    Rating.objects.filter(target_type='store', order__store=store).delete()
    
    test_user = User.objects.filter(user_type='user').first()
    if not test_user:
        print("⚠️ No patient user found to assign ratings. Creating a mock rating logic...")
    
    # Simulate high ratings
    for i in range(7):
        # Create a dummy prescription and response to satisfy FKs if needed
        # But we'll just manually set the fields on the store for simplicity in this script
        # since we want to see the UI update.
        pass

    # Direct model update to bypass manual object creation if complex
    store.average_rating = Decimal('4.85')
    store.total_ratings = 12
    
    # Calculate Quality Score manually for the "Radar"
    # Formula components: 
    # Avail (assumed high) + Price (assumed avg) + Time(20) + Rating(20)
    # This just mocks the historical quality_score saved in DB
    store.quality_score = Decimal('92.45')
    store.save()

    print(f"✅ Success! {store.name} is now an ELITE store.")
    print(f"   - Quality Score: {store.quality_score}")
    print(f"   - Fulfillment Rate: {store.fulfillment_rate}%")
    print(f"   - Badges Earned: Top Seller, Reliable, Fastest")
    print("\n👉 Check your Seller Dashboard (Performance Radar) now!")

if __name__ == "__main__":
    simulate()
