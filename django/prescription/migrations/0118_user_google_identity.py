from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('prescription', '0117_phone_first_user'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='google_email',
            field=models.EmailField(blank=True, default='', max_length=254),
        ),
        migrations.AddField(
            model_name='user',
            name='google_linked_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='google_sub',
            field=models.CharField(blank=True, max_length=255, null=True, unique=True),
        ),
    ]
