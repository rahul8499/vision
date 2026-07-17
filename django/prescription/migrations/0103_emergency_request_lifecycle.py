from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('prescription', '0102_account_preferred_language'),
    ]

    operations = [
        migrations.AddField(
            model_name='prescription',
            name='emergency_cancel_reason',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='prescription',
            name='emergency_cancelled_at',
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
    ]
