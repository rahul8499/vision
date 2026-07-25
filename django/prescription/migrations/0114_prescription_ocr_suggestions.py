from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('prescription', '0113_delivery_return_workflow'),
    ]

    operations = [
        migrations.AddField(
            model_name='prescription',
            name='extracted_medicines',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='prescription',
            name='ocr_engine',
            field=models.CharField(blank=True, default='', max_length=40),
        ),
    ]
