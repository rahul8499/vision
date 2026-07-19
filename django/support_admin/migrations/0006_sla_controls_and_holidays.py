import datetime
from django.db import migrations, models
import django.db.models.deletion


def set_default_working_days(apps, schema_editor):
    apps.get_model("support_admin", "SLAConfiguration").objects.filter(working_days=[]).update(working_days=[0, 1, 2, 3, 4, 5])


class Migration(migrations.Migration):
    dependencies = [("support_admin", "0005_seed_support_operations_defaults")]
    operations = [
        migrations.AddField(model_name="slaconfiguration", name="working_hours_only", field=models.BooleanField(default=False)),
        migrations.AddField(model_name="slaconfiguration", name="workday_start", field=models.TimeField(default=datetime.time(9, 0))),
        migrations.AddField(model_name="slaconfiguration", name="workday_end", field=models.TimeField(default=datetime.time(18, 0))),
        migrations.AddField(model_name="slaconfiguration", name="working_days", field=models.JSONField(blank=True, default=list, help_text="Weekdays: Monday=0 through Sunday=6")),
        migrations.AddField(model_name="slaconfiguration", name="pause_when_waiting", field=models.BooleanField(default=True)),
        migrations.AddField(model_name="slaconfiguration", name="warning_minutes", field=models.PositiveIntegerField(default=30)),
        migrations.AddField(model_name="slaconfiguration", name="auto_escalate", field=models.BooleanField(default=False)),
        migrations.AddField(model_name="slaconfiguration", name="auto_assign", field=models.BooleanField(default=False)),
        migrations.CreateModel(name="SupportHoliday", fields=[("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")), ("date", models.DateField(unique=True)), ("name", models.CharField(max_length=120)), ("is_active", models.BooleanField(default=True))], options={"ordering": ["date"]}),
        migrations.CreateModel(name="CaseSLAClock", fields=[("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")), ("object_id", models.PositiveBigIntegerField()), ("paused_at", models.DateTimeField(blank=True, null=True)), ("paused_seconds", models.PositiveBigIntegerField(default=0)), ("warning_stage", models.CharField(blank=True, max_length=30)), ("breached_stage", models.CharField(blank=True, max_length=30)), ("escalated_stage", models.CharField(blank=True, max_length=30)), ("updated_at", models.DateTimeField(auto_now=True)), ("content_type", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="contenttypes.contenttype"))], options={"constraints": [models.UniqueConstraint(fields=("content_type", "object_id"), name="unique_case_sla_clock")]}),
        migrations.AddField(model_name="contactlog", name="status", field=models.CharField(choices=[("scheduled", "Scheduled"), ("completed", "Completed"), ("cancelled", "Cancelled")], default="scheduled", max_length=20)),
        migrations.AddField(model_name="contactlog", name="completed_at", field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name="contactlog", name="updated_at", field=models.DateTimeField(auto_now=True)),
        migrations.RunPython(set_default_working_days, migrations.RunPython.noop),
    ]
