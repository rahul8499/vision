from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('prescription', '0093_appnotification'),
    ]

    operations = [
        migrations.AlterField(
            model_name='storereportnote',
            name='response',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.CASCADE,
                related_name='store_reports', to='prescription.prescriptionresponse',
            ),
        ),
        migrations.AddField(
            model_name='storereportnote',
            name='prescription',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.CASCADE,
                related_name='store_reports', to='prescription.prescription',
            ),
        ),
    ]
