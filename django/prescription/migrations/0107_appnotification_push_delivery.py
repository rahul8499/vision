from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("prescription", "0106_safetyreport_assigned_to_id_safetyreport_city_and_more")]
    operations = [
        migrations.AddField(model_name="appnotification", name="push_status", field=models.CharField(blank=True, db_index=True, default="", max_length=24)),
        migrations.AddField(model_name="appnotification", name="push_ticket_id", field=models.CharField(blank=True, db_index=True, default="", max_length=120)),
        migrations.AddField(model_name="appnotification", name="push_attempts", field=models.PositiveSmallIntegerField(default=0)),
        migrations.AddField(model_name="appnotification", name="push_error", field=models.TextField(blank=True, default="")),
        migrations.AddField(model_name="appnotification", name="push_last_attempt_at", field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name="appnotification", name="push_receipt_checked_at", field=models.DateTimeField(blank=True, null=True)),
    ]
