from django.db import migrations


def seed_defaults(apps, schema_editor):
    SLA = apps.get_model("support_admin", "SLAConfiguration")
    policies = [
        ("complaint", "urgent", 15, 240), ("complaint", "high", 30, 480),
        ("complaint", "medium", 60, 1440), ("complaint", "low", 240, 2880),
        ("ticket", "urgent", 15, 240), ("ticket", "high", 30, 480),
        ("ticket", "medium", 60, 1440), ("ticket", "low", 240, 2880),
        ("refund", "default", 60, 1440),
        ("safety_report", "critical", 10, 120), ("safety_report", "high", 30, 480),
        ("safety_report", "medium", 60, 1440), ("safety_report", "low", 240, 2880),
    ]
    for entity, priority, first, resolution in policies:
        SLA.objects.get_or_create(entity_type=entity, priority=priority, defaults={"first_response_minutes": first, "resolution_minutes": resolution, "is_active": True})


class Migration(migrations.Migration):
    dependencies = [("support_admin", "0004_contactlog_savedreplytemplate")]
    operations = [migrations.RunPython(seed_defaults, migrations.RunPython.noop)]
