# Production Architecture & Scaling Guide

To handle millions of users effectively, follow these infrastructure guidelines.

## 1. Django Production Server (Gunicorn)
Do NOT use `python manage.py runserver` in production. Use Gunicorn with a worker-thread model.

### Recommended Command:
```bash
gunicorn aarx.wsgi:application \
  --workers 4 \
  --threads 2 \
  --bind 0.0.0.0:8000 \
  --access-logfile - \
  --error-logfile -
```
*   **Workers**: Usually `(2 x $num_cores) + 1`.
*   **Threads**: Helps handle I/O bound tasks (like waiting for Google/Mapbox APIs).

---

## 2. Reverse Proxy (Nginx)
Always place Nginx in front of Gunicorn.

### Key Benefits:
- **Rate Limiting**: Add IP-based throttling at the connection level.
- **SSL Termination**: Handle HTTPS certificates (LetsEncrypt).
- **Static Files**: Serve CSS/JS/Images faster than Django.

---

## 3. Horizontal Scaling
When one server isn't enough:
1.  **Load Balancer**: Use AWS ALB, DigitalOcean Load Balancer, or Nginx.
2.  **Shared Cache**: Use a central Redis instance (Managed Redis on AWS ElastiCache / DigitalOcean) so all servers share the same location cache.
3.  **Stateless Servers**: Ensure Django servers don't store local state; everything should be in the DB or Redis.

---

## 4. Third-Party API Strategy
### Google Places & Mapbox
I have implemented multi-provider support in `views.py`.
1.  Add `GOOGLE_PLACES_API_KEY = "your-key"` to `settings.py`.
2.  The system will automatically switch from Nominatim to Google.
3.  **Edge Caching**: Consider using Cloudflare in front of your domain to cache the API responses at the edge, reducing backend load even further.

---

## 5. Summary of Code Optimizations Installed
- ✅ **Frontend Debounce (800ms)**: Minimizes hits during typing.
- ✅ **Backend Throttling (3 req/sec)**: Protects against bots and abuse.
- ✅ **Redis Caching (24h)**: Eliminates redundant external API calls.
- ✅ **Provider Priority**: Automatically uses the most reliable API available.
