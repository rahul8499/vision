from django.db import migrations, models


def raise_existing_capacity(apps, schema_editor):
    StoreDeliveryPerson = apps.get_model('prescription', 'StoreDeliveryPerson')
    StoreDeliveryPerson.objects.filter(max_concurrent_orders__lt=100).update(max_concurrent_orders=100)


class Migration(migrations.Migration):
    dependencies = [('prescription', '0108_delivery_partner_access')]

    operations = [
        migrations.AlterField(model_name='storedeliveryperson', name='max_concurrent_orders', field=models.PositiveIntegerField(default=100)),
        migrations.RunPython(raise_existing_capacity, migrations.RunPython.noop),
    ]
