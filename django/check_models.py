import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "aarx.settings")
django.setup()

from prescription.models import ChatMessage

print([f.name for f in ChatMessage._meta.fields])
