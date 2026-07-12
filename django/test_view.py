import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "aarx.settings")
django.setup()

from prescription.models import PrescriptionResponse, Store, User, Prescription
from prescription.views import StoreUpdateProgressView
from rest_framework.test import APIRequestFactory

# create dummy data
store = Store.objects.create(name="test_store", mobile="1234567890", email="test@test.com", password="pwd")
user = User.objects.create(name="test_user", mobile="0987654321", email="user@test.com", password="pwd")
prescription = Prescription.objects.create(user=user)

r = PrescriptionResponse.objects.create(
    prescription=prescription,
    store=store,
    user=user,
    user_status="accepted" # mock an accepted order
)

factory = APIRequestFactory()
request = factory.post(f'/api/responses/{r.id}/progress/', {'action': 'start_processing'}, format='json')
request.user = store

view = StoreUpdateProgressView.as_view()
response = view(request, response_id=r.id)

print("STATUS:", response.status_code)
print("BODY:", response.data)

# Clean up
r.delete()
prescription.delete()
store.delete()
user.delete()
