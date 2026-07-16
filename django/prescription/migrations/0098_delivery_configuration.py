import decimal
import django.db.models.deletion
from django.db import migrations, models


def create_default_delivery_settings(apps, schema_editor):
    Store = apps.get_model('prescription', 'Store')
    StoreDeliverySettings = apps.get_model('prescription', 'StoreDeliverySettings')
    StoreDeliverySettings.objects.bulk_create(
        [StoreDeliverySettings(store_id=store_id) for store_id in Store.objects.values_list('id', flat=True)],
        ignore_conflicts=True,
    )


class Migration(migrations.Migration):
    dependencies = [('prescription', '0097_pharmacist_consultations')]

    operations = [
        migrations.CreateModel(
            name='StoreDeliverySettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('pickup_enabled', models.BooleanField(default=True)),
                ('home_delivery_enabled', models.BooleanField(default=False)),
                ('maximum_delivery_radius_km', models.DecimalField(decimal_places=2, default=decimal.Decimal('5.00'), max_digits=6)),
                ('free_delivery_distance_km', models.DecimalField(decimal_places=2, default=decimal.Decimal('0.00'), max_digits=6)),
                ('base_delivery_charge', models.DecimalField(decimal_places=2, default=decimal.Decimal('0.00'), max_digits=8)),
                ('per_km_charge', models.DecimalField(decimal_places=2, default=decimal.Decimal('0.00'), max_digits=8)),
                ('minimum_delivery_charge', models.DecimalField(decimal_places=2, default=decimal.Decimal('0.00'), max_digits=8)),
                ('maximum_delivery_charge', models.DecimalField(blank=True, decimal_places=2, max_digits=8, null=True)),
                ('default_estimated_delivery_minutes', models.PositiveIntegerField(default=45)),
                ('delivery_time_per_km_minutes', models.DecimalField(decimal_places=2, default=decimal.Decimal('0.00'), max_digits=5)),
                ('delivery_message_template', models.CharField(default='We can deliver to your location in approximately {eta} minutes.', max_length=240)),
                ('delivery_unavailable_message', models.CharField(default='Home delivery is currently unavailable. You can pick up your order from the store.', max_length=240)),
                ('is_active', models.BooleanField(default=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('store', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='delivery_settings', to='prescription.store')),
            ],
        ),
        migrations.CreateModel(
            name='StoreDeliveryPerson',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=120)),
                ('mobile', models.CharField(max_length=15)),
                ('vehicle_type', models.CharField(choices=[('walk', 'On Foot'), ('bicycle', 'Bicycle'), ('bike', 'Motorbike'), ('scooter', 'Scooter'), ('car', 'Car'), ('other', 'Other')], default='bike', max_length=20)),
                ('vehicle_number', models.CharField(blank=True, max_length=30)),
                ('is_active', models.BooleanField(db_index=True, default=True)),
                ('is_available', models.BooleanField(db_index=True, default=True)),
                ('current_order_count', models.PositiveIntegerField(default=0)),
                ('max_concurrent_orders', models.PositiveIntegerField(default=1)),
                ('last_assigned_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('store', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='delivery_people', to='prescription.store')),
            ],
            options={'ordering': ['-is_available', 'current_order_count', 'name']},
        ),
        migrations.CreateModel(
            name='QuoteDeliveryOffer',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('distance_km', models.DecimalField(blank=True, decimal_places=2, max_digits=7, null=True)),
                ('pickup_available', models.BooleanField(default=True)),
                ('home_delivery_available', models.BooleanField(default=False)),
                ('eligibility_code', models.CharField(choices=[('eligible', 'Eligible'), ('delivery_disabled', 'Delivery Disabled'), ('outside_radius', 'Outside Delivery Radius'), ('user_location_missing', 'User Location Missing'), ('store_location_missing', 'Store Location Missing'), ('delivery_person_unavailable', 'Delivery Person Unavailable'), ('temporarily_unavailable', 'Temporarily Unavailable'), ('store_closed', 'Store Closed'), ('manual_override', 'Manual Override')], default='delivery_disabled', max_length=40)),
                ('unavailable_reason', models.CharField(blank=True, max_length=240)),
                ('delivery_charge', models.DecimalField(decimal_places=2, default=decimal.Decimal('0.00'), max_digits=8)),
                ('estimated_delivery_minutes', models.PositiveIntegerField(blank=True, null=True)),
                ('delivery_message', models.CharField(blank=True, max_length=240)),
                ('settings_snapshot', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('assigned_delivery_person', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='assigned_offers', to='prescription.storedeliveryperson')),
                ('response', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='delivery_offer', to='prescription.prescriptionresponse')),
            ],
        ),
        migrations.AddConstraint(
            model_name='storedeliveryperson',
            constraint=models.UniqueConstraint(fields=('store', 'mobile'), name='unique_delivery_person_mobile_per_store'),
        ),
        migrations.RunPython(create_default_delivery_settings, migrations.RunPython.noop),
    ]
