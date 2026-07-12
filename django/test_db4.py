import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aarx.settings')
django.setup()

from django.core.cache import cache
store_id = 1 # guess from the first store
print(cache.keys("*nearby_rx*"))
