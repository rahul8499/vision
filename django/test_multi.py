import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aarx.settings')
django.setup()

from prescription.models import PrescriptionResponse
from django.db.models import Count

resps = PrescriptionResponse.objects.values('prescription').annotate(c=Count('id')).filter(c__gt=1)
for r in resps:
    print(r)
