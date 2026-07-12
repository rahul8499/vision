import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "aarx.settings")
django.setup()

from prescription.models import PrescriptionResponse

r = PrescriptionResponse()
try:
    r.save(user_context="test")
    print("Success")
except Exception as e:
    import traceback
    traceback.print_exc()
