from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('prescription', '0099_orderreplacementrequest')]
    operations = [
        migrations.AddField(model_name='orderreplacementrequest', name='approved_at', field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name='orderreplacementrequest', name='rejected_at', field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name='orderreplacementrequest', name='in_transit_at', field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name='orderreplacementrequest', name='completed_at', field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name='orderreplacementrequest', name='cancelled_at', field=models.DateTimeField(blank=True, null=True)),
    ]
