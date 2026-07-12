from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include
from django.http import HttpResponse  # ✅ Import this for home_view

# ✅ Simple homepage view
def home_view(request):
    return HttpResponse(
        "<h1>Welcome to the Medical Prescription App API</h1>"
        "<p>Use the <code>/api/</code> route to access endpoints like store registration and prescription upload.</p>"
    )

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('prescription.urls')),
    path('api/subscriptions/', include('subscription.urls')),
    path('', home_view),  # ✅ Root path points to home_view directly
]

# ✅ Serve media files during development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
