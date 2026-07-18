from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('complaints', '0002_platform_support_tickets'),
    ]

    operations = [
        migrations.AddField(
            model_name='complaintmessage',
            name='visibility',
            field=models.CharField(
                choices=[
                    ('USER_SUPPORT', 'User and support'),
                    ('STORE_SUPPORT', 'Store and support'),
                    ('SHARED', 'All complaint parties'),
                    ('INTERNAL', 'Support only'),
                ],
                db_index=True,
                default='SHARED',
                max_length=20,
            ),
        ),
    ]
