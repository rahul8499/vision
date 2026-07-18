from django import forms

from .models import City, ServiceZone


class RadiusBoundaryFormMixin:
    def clean(self):
        cleaned = super().clean()
        mode = cleaned.get("boundary_mode")
        latitude = cleaned.get("center_latitude")
        longitude = cleaned.get("center_longitude")
        radius = cleaned.get("service_radius_km")
        boundary = cleaned.get("boundary")

        if mode == "radius":
            if latitude is None or longitude is None:
                raise forms.ValidationError(
                    "Automatic radius mode requires center latitude and longitude."
                )
            if not -90 <= latitude <= 90:
                self.add_error("center_latitude", "Latitude must be between -90 and 90.")
            if not -180 <= longitude <= 180:
                self.add_error("center_longitude", "Longitude must be between -180 and 180.")
            if not radius or radius < 1:
                self.add_error("service_radius_km", "Radius must be at least 1 km.")
        elif mode == "manual" and not boundary:
            self.add_error("boundary", "Draw a polygon when using advanced manual mode.")
        return cleaned


class CityAdminForm(RadiusBoundaryFormMixin, forms.ModelForm):
    class Meta:
        model = City
        fields = "__all__"
        help_texts = {
            "center_latitude": "City center latitude, for example Pune: 18.5204.",
            "center_longitude": "City center longitude, for example Pune: 73.8567.",
            "service_radius_km": "The service boundary is generated automatically from this radius.",
            "boundary": "Advanced only. Use this when a circular service area is not suitable.",
        }


class ServiceZoneAdminForm(RadiusBoundaryFormMixin, forms.ModelForm):
    class Meta:
        model = ServiceZone
        fields = "__all__"
        help_texts = {
            "center_latitude": "Center latitude of this local service zone.",
            "center_longitude": "Center longitude of this local service zone.",
            "service_radius_km": "Recommended starting value: 3–7 km.",
            "boundary": "Advanced only. Draw a custom zone polygon if needed.",
        }
