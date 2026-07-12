import os
import django
import asyncio
import httpx
import time
import random
import statistics
import uuid

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aarx.settings')
django.setup()

from prescription.models import Store

# Get or create a store and explicitly set a token
store = Store.objects.filter(is_active=True).first()
if not store:
    store = Store.objects.create(name="Bench", mobile="9999999999", email="bench@test.com", password="xx", is_active=True, latitude=18.5204, longitude=73.8567)

if not store.token:
    store.token = str(uuid.uuid4())
    store.save()

BASE_URL = "http://localhost:8000/api/nearby-prescriptions/"
CONCURRENT_REQUESTS = 300  # Start with 300 to match user's benchmark_spatial.py

HOTSPOT_LAT = 18.5204
HOTSPOT_LON = 73.8567

async def make_request(client, request_id):
    lat = HOTSPOT_LAT + random.uniform(-0.1, 0.1)
    lon = HOTSPOT_LON + random.uniform(-0.1, 0.1)
    
    headers = {"Authorization": f"Bearer {store.token}"} 
    
    start_time = time.perf_counter()
    try:
        response = await client.get(BASE_URL, headers=headers, params={"lat": lat, "lon": lon})
        duration = (time.perf_counter() - start_time) * 1000
        return duration, response.status_code
    except Exception as e:
        return None, str(e)

async def run_benchmark():
    print(f"🚀 Starting Massive Benchmark: {CONCURRENT_REQUESTS} parallel requests...")
    
    limits = httpx.Limits(max_connections=CONCURRENT_REQUESTS, max_keepalive_connections=CONCURRENT_REQUESTS)
    timeout = httpx.Timeout(30.0)
    
    async with httpx.AsyncClient(limits=limits, timeout=timeout) as client:
        tasks = [make_request(client, i) for i in range(CONCURRENT_REQUESTS)]
        results = await asyncio.gather(*tasks)
        
    durations = [r[0] for r in results if r[0] is not None and r[1] == 200]
    errors = [r[1] for r in results if r[0] is None or r[1] != 200]
    
    if durations:
        print("\n📊 Results:")
        print(f"✅ Successful Requests (200 OK): {len(durations)}")
        print(f"❌ Failed Requests: {len(errors)}")
        if errors:
            print(f"Sample Errors: {errors[:5]}")
        print(f"⏱️ Min Response Time: {min(durations):.2f} ms")
        print(f"⚡ Max Response Time: {max(durations):.2f} ms")
        print(f"📈 Average Response Time: {statistics.mean(durations):.2f} ms")
        print(f"🎯 Median Response Time: {statistics.median(durations):.2f} ms")
    else:
        print("❌ No successful requests recorded.")
        if errors:
            print(f"Sample Errors: {errors[:5]}")

if __name__ == "__main__":
    asyncio.run(run_benchmark())
