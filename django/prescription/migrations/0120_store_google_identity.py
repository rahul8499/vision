from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('prescription', '0119_user_google_link_nonce'),
    ]

    operations = [
        migrations.AddField(model_name='store', name='google_email', field=models.EmailField(blank=True, default='', max_length=254)),
        migrations.AddField(model_name='store', name='google_link_nonce_expires_at', field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name='store', name='google_link_nonce_hash', field=models.CharField(blank=True, default='', max_length=64)),
        migrations.AddField(model_name='store', name='google_linked_at', field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name='store', name='google_sub', field=models.CharField(blank=True, max_length=255, null=True, unique=True)),
    ]
