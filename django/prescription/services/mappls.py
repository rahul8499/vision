import asyncio

from asgiref.sync import sync_to_async
from django.conf import settings
from django.core.cache import cache

TOKEN_CACHE_KEY = "mappls_oauth_access_token_v1"
TOKEN_LOCK_KEY = "mappls_oauth_access_token_lock_v1"
TOKEN_URL = "https://outpost.mappls.com/api/security/oauth/token"
AUTOSUGGEST_URL = "https://atlas.mappls.com/api/places/search/json"
PLACE_DETAILS_URL = "https://explore.mappls.com/apis/O2O/entity/{eloc}"


def is_configured():
    return bool(getattr(settings, "MAPPLS_CLIENT_ID", None) and getattr(settings, "MAPPLS_CLIENT_SECRET", None))


async def _cached_token():
    return await sync_to_async(cache.get)(TOKEN_CACHE_KEY)


async def get_access_token(client):
    token = await _cached_token()
    if token:
        return token
    owns_lock = await sync_to_async(cache.add)(TOKEN_LOCK_KEY, "1", timeout=15)
    if not owns_lock:
        for _ in range(10):
            await asyncio.sleep(0.1)
            token = await _cached_token()
            if token:
                return token
    try:
        response = await client.post(TOKEN_URL, data={
            "grant_type": "client_credentials",
            "client_id": settings.MAPPLS_CLIENT_ID,
            "client_secret": settings.MAPPLS_CLIENT_SECRET,
        })
        response.raise_for_status()
        payload = response.json()
        token = payload.get("access_token")
        if not token:
            raise ValueError("Mappls token response did not include an access token")
        expires_in = max(int(payload.get("expires_in", 3600)) - 60, 60)
        await sync_to_async(cache.set)(TOKEN_CACHE_KEY, token, timeout=expires_in)
        return token
    finally:
        if owns_lock:
            await sync_to_async(cache.delete)(TOKEN_LOCK_KEY)


async def search(client, query, latitude=None, longitude=None):
    if not is_configured():
        return []
    token = await get_access_token(client)
    params = {"query": query[:45], "region": "IND"}
    if latitude and longitude:
        params.update(location=f"{latitude},{longitude}", hyperLocal="")
    response = await client.get(AUTOSUGGEST_URL, params=params, headers={"Authorization": f"Bearer {token}"})
    response.raise_for_status()
    payload = response.json()
    locations = payload.get("suggestedLocations", []) + payload.get("userAddedLocations", [])
    results = []
    for item in sorted(locations, key=lambda value: value.get("orderIndex", 999))[:5]:
        eloc = item.get("eLoc") or item.get("eloc")
        if not eloc:
            continue
        name = item.get("placeName", "").strip()
        address = item.get("placeAddress", "").strip()
        latitude_value = item.get("latitude")
        longitude_value = item.get("longitude")
        results.append({
            "place_id": f"mappls:{eloc}",
            "display_name": ", ".join(part for part in (name, address) if part) or eloc,
            "lat": str(latitude_value) if latitude_value is not None else "",
            "lon": str(longitude_value) if longitude_value is not None else "",
            "is_prediction": latitude_value is None or longitude_value is None,
            "provider": "mappls",
        })
    return results


async def place_details(client, place_id):
    if not is_configured() or not place_id.startswith("mappls:"):
        return None
    eloc = place_id.split(":", 1)[1]
    if not eloc or len(eloc) > 20:
        return None
    token = await get_access_token(client)
    response = await client.get(PLACE_DETAILS_URL.format(eloc=eloc), headers={"Authorization": f"Bearer {token}"})
    response.raise_for_status()
    payload = response.json()
    latitude = payload.get("latitude") or payload.get("lat")
    longitude = payload.get("longitude") or payload.get("lng") or payload.get("lon")
    if latitude is None or longitude is None:
        return None
    return {"lat": str(latitude), "lon": str(longitude)}
