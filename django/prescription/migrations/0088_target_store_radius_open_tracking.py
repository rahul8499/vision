from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('prescription', '0087_prescription_dispatch_batches'),
    ]

    operations = [
        migrations.AddField(
            model_name='prescriptiontargetstore',
            name='opened_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='prescriptiontargetstore',
            name='radius_max_km',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True),
        ),
        migrations.AddField(
            model_name='prescriptiontargetstore',
            name='radius_min_km',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True),
        ),
    ]
