import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aarx.settings')
django.setup()

from prescription.models import PrescriptionResponse
from prescription.serializers import PrescriptionResponseSerializer
import json

resps = PrescriptionResponse.objects.filter(total_amount__isnull=False)
if resps.exists():
    for r in resps:
        data = PrescriptionResponseSerializer(r).data
        print(f"ID: {r.id}, Prescription: {r.prescription_id}, Amount: {r.total_amount}, BestDeal: {data.get('best_deal')}")
