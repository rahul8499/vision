from decimal import Decimal, ROUND_HALF_UP
from math import ceil

from django.contrib.gis.db.models.functions import Distance

from prescription.models import StoreDeliverySettings


MONEY_STEP = Decimal('0.01')
DISTANCE_STEP = Decimal('0.01')


def get_or_create_delivery_settings(store):
    settings, _ = StoreDeliverySettings.objects.get_or_create(store=store)
    return settings


def _decimal(value):
    return Decimal(str(value))


def calculate_delivery_distance_km(store, prescription):
    if not store.location or not prescription.location:
        return None
    annotated = prescription.__class__.objects.filter(pk=prescription.pk).annotate(
        delivery_distance=Distance('location', store.location)
    ).values_list('delivery_distance', flat=True).first()
    if not annotated:
        return None
    return _decimal(annotated.km).quantize(DISTANCE_STEP, rounding=ROUND_HALF_UP)


def _render_message(template, eta, distance, charge):
    values = {
        'eta': eta or '',
        'distance': distance or '',
        'charge': charge or Decimal('0.00'),
    }
    try:
        return template.format(**values)[:240]
    except (KeyError, ValueError, IndexError):
        return template[:240]


def evaluate_delivery_eligibility(store, prescription, settings=None):
    settings = settings or get_or_create_delivery_settings(store)
    distance = calculate_delivery_distance_km(store, prescription)
    result = {
        'distance_km': distance,
        'pickup_available': bool(settings.is_active and settings.pickup_enabled),
        'home_delivery_available': False,
        'eligibility_code': 'delivery_disabled',
        'unavailable_reason': settings.delivery_unavailable_message,
        'delivery_charge': Decimal('0.00'),
        'estimated_delivery_minutes': None,
        'delivery_message': settings.delivery_unavailable_message,
        'settings_snapshot': {
            'home_delivery_enabled': settings.home_delivery_enabled,
            'pickup_enabled': settings.pickup_enabled,
            'maximum_delivery_radius_km': str(settings.maximum_delivery_radius_km),
            'free_delivery_distance_km': str(settings.free_delivery_distance_km),
            'base_delivery_charge': str(settings.base_delivery_charge),
            'per_km_charge': str(settings.per_km_charge),
            'minimum_delivery_charge': str(settings.minimum_delivery_charge),
            'maximum_delivery_charge': str(settings.maximum_delivery_charge) if settings.maximum_delivery_charge is not None else None,
            'default_estimated_delivery_minutes': settings.default_estimated_delivery_minutes,
            'delivery_time_per_km_minutes': str(settings.delivery_time_per_km_minutes),
        },
    }
    if not settings.is_active or not settings.home_delivery_enabled:
        return result
    if not store.location:
        result.update(eligibility_code='store_location_missing', unavailable_reason='Store location is not configured.', delivery_message='Store location is not configured for delivery.')
        return result
    if not prescription.location:
        result.update(eligibility_code='user_location_missing', unavailable_reason='Customer location is required for home delivery.', delivery_message='Add a delivery location to check home delivery.')
        return result
    if distance is None:
        result.update(eligibility_code='user_location_missing', unavailable_reason='Delivery distance could not be calculated.', delivery_message='Delivery distance could not be calculated.')
        return result
    if distance > settings.maximum_delivery_radius_km:
        message = f'Home delivery is unavailable beyond {settings.maximum_delivery_radius_km} km. Store pickup is available.'
        result.update(eligibility_code='outside_radius', unavailable_reason=message, delivery_message=message)
        return result

    if distance <= settings.free_delivery_distance_km:
        charge = Decimal('0.00')
    else:
        chargeable_distance = distance - settings.free_delivery_distance_km
        charge = settings.base_delivery_charge + (chargeable_distance * settings.per_km_charge)
        charge = max(charge, settings.minimum_delivery_charge)
        if settings.maximum_delivery_charge is not None:
            charge = min(charge, settings.maximum_delivery_charge)
        charge = charge.quantize(MONEY_STEP, rounding=ROUND_HALF_UP)

    eta = settings.default_estimated_delivery_minutes + ceil(float(distance * settings.delivery_time_per_km_minutes))
    eta = max(5, min(240, eta))
    message = _render_message(settings.delivery_message_template, eta, distance, charge)
    result.update(
        home_delivery_available=True,
        eligibility_code='eligible',
        unavailable_reason='',
        delivery_charge=charge,
        estimated_delivery_minutes=eta,
        delivery_message=message,
    )
    return result


def apply_quote_delivery_override(calculated, override):
    if not isinstance(override, dict):
        return calculated
    result = dict(calculated)
    if override.get('home_delivery_available') is False:
        reason = str(override.get('unavailable_reason') or 'Home delivery is temporarily unavailable.')[:240]
        result.update(
            home_delivery_available=False,
            eligibility_code='manual_override',
            unavailable_reason=reason,
            delivery_charge=Decimal('0.00'),
            estimated_delivery_minutes=None,
            delivery_message=str(override.get('delivery_message') or reason)[:240],
        )
        return result
    if calculated['home_delivery_available']:
        if override.get('delivery_charge') not in (None, ''):
            charge = _decimal(override['delivery_charge'])
            if charge < 0:
                raise ValueError('Delivery charge cannot be negative.')
            result['delivery_charge'] = charge.quantize(MONEY_STEP, rounding=ROUND_HALF_UP)
        if override.get('estimated_delivery_minutes') not in (None, ''):
            eta = int(override['estimated_delivery_minutes'])
            if not 5 <= eta <= 240:
                raise ValueError('Estimated delivery time must be between 5 and 240 minutes.')
            result['estimated_delivery_minutes'] = eta
        if override.get('delivery_message'):
            result['delivery_message'] = str(override['delivery_message'])[:240]
    return result


def release_assigned_delivery_person(response):
    try:
        person = response.delivery_offer.assigned_delivery_person
    except Exception:
        person = None
    if not person:
        return
    person.current_order_count = max(0, person.current_order_count - 1)
    person.save(update_fields=['current_order_count', 'updated_at'])
