from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [('prescription', '0100_replacement_status_timestamps')]
    operations = [
        migrations.AddField(
            model_name='orderreplacementrequest', name='assigned_delivery_person',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='replacement_assignments', to='prescription.storedeliveryperson'),
        ),
        migrations.AddField(model_name='orderreplacementrequest', name='estimated_delivery_minutes', field=models.PositiveIntegerField(blank=True, null=True)),
        migrations.AddField(model_name='orderreplacementrequest', name='estimated_arrival_at', field=models.DateTimeField(blank=True, null=True)),
    ]
