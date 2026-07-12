import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aarx.settings')
django.setup()

from django.test.client import RequestFactory
from prescription.views import StoreDashboardSummaryView
from prescription.models import Store
from django.contrib.auth import get_user_model
User = get_user_model()

store = Store.objects.first()
user = User.objects.get(id=store.user_id) if hasattr(store, 'user_id') else User.objects.first()

factory = RequestFactory()
request = factory.get('/api/store/dashboard-summary/?start_date=2024-01-01&end_date=2026-12-31')
request.user = user

view = StoreDashboardSummaryView.as_view()
response = view(request)
print("Status Code:", response.status_code)
if response.status_code == 200:
    data = response.data
    print("Today Stats (Filtered):")
    print(data['today'])
else:
    print("Error:", response.data)
