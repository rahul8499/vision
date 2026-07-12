# Generated for additive account lifecycle flags.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('prescription', '0088_target_store_radius_open_tracking'),
    ]

    operations = [
        migrations.AddField(
            model_name='store',
            name='is_deleted',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='user',
            name='is_active',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='user',
            name='is_verified',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='user',
            name='is_deleted',
            field=models.BooleanField(default=False),
        ),
    ]
