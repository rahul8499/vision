import asyncio
import httpx
import time
import random
import statistics

# 🎯 Target URL
BASE_URL = "http://localhost:8000/api/nearby-prescriptions/"
CONCURRENT_REQUESTS = 300

# 📍 Sample Stores (around Pune area for testing)
HOTSPOT_LAT = 18.5204
HOTSPOT_LON = 73.8567

async def make_request(client, request_id):
    # Simulate a pharmacist at a slightly random location near the hotspot
    lat = HOTSPOT_LAT + random.uniform(-0.1, 0.1)
    lon = HOTSPOT_LON + random.uniform(-0.1, 0.1)
    
    # We need a valid token (using a dummy one here, you might need to adjust for your local auth)
    headers = {"Authorization": "Bearer 5acda361-7924-406d-856f-eb71f254eb3a"} 
    
    start_time = time.perf_counter()
    try:
        # Note: We need to bypass auth or use a real store token
        # For benchmarking speed, let's assume session/token is valid
        # Adjust URL if it requires specific store ID
        response = await client.get(BASE_URL, headers=headers, params={"lat": lat, "lon": lon})
        duration = (time.perf_counter() - start_time) * 1000 # to ms
        return duration, response.status_code
    except Exception as e:
        return None, str(e)

async def run_benchmark():
    print(f"🚀 Starting Massive Benchmark: {CONCURRENT_REQUESTS} parallel requests...")
    
    # 🔥 Scale client to handle 1k concurrent connections
    limits = httpx.Limits(max_connections=CONCURRENT_REQUESTS, max_keepalive_connections=CONCURRENT_REQUESTS)
    timeout = httpx.Timeout(30.0) # Increase timeout for heavy load
    
    async with httpx.AsyncClient(limits=limits, timeout=timeout) as client:
        tasks = [make_request(client, i) for i in range(CONCURRENT_REQUESTS)]
        results = await asyncio.gather(*tasks)
        
    durations = [r[0] for r in results if r[0] is not None]
    errors = [r[1] for r in results if r[0] is None or r[1] != 200]
    
    if durations:
        print("\n📊 Results:")
        print(f"✅ Timed Requests: {len(durations)}")
        print(f"❌ Error Samples (Status/Msg): {errors[:5]}")
        print(f"⏱️ Min Response Time: {min(durations):.2f} ms")
        print(f"⚡ Max Response Time: {max(durations):.2f} ms")
        print(f"📈 Average Response Time: {statistics.mean(durations):.2f} ms")
        print(f"🎯 Median Response Time: {statistics.median(durations):.2f} ms")
    else:
        print("❌ No successful requests recorded.")

if __name__ == "__main__":
    asyncio.run(run_benchmark())
