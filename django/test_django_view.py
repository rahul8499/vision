import os
import django
import asyncio
from asgiref.sync import sync_to_async

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "aarx.settings")
django.setup()

from prescription.views import LocationSearchView
from rest_framework.test import APIRequestFactory
import httpx

original_get = httpx.AsyncClient.get
async def mock_get(self, url, *args, **kwargs):
    print("MOCK GET CALLED WITH URL:", url)
    return await original_get(self, url, *args, **kwargs)

httpx.AsyncClient.get = mock_get

async def main():
    factory = APIRequestFactory()
    request = factory.get('/api/search-location/?q=Durga%20hotel%2C%20lohegaon&lat=18.6044519&lon=73.9324207')
    view = LocationSearchView()
    view.request = request
    from rest_framework.request import Request
    drf_request = Request(request)
    response = await view._async_get(drf_request)
    print("Status:", response.status_code)
    print("Data:", response.data)

asyncio.run(main())
