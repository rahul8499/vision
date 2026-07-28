from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('prescription', '0118_user_google_identity'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='google_link_nonce_hash',
            field=models.CharField(blank=True, default='', max_length=64),
        ),
        migrations.AddField(
            model_name='user',
            name='google_link_nonce_expires_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
