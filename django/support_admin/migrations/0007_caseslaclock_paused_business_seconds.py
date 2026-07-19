from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("support_admin", "0006_sla_controls_and_holidays")]

    operations = [
        migrations.AddField(
            model_name="caseslaclock",
            name="paused_business_seconds",
            field=models.PositiveBigIntegerField(default=0),
        ),
    ]
