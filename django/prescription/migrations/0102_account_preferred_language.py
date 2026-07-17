from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('prescription', '0101_replacement_delivery_assignment')]

    operations = [
        migrations.AddField(
            model_name='store',
            name='preferred_language',
            field=models.CharField(choices=[('en', 'English'), ('hi', 'Hindi'), ('mr', 'Marathi')], db_index=True, default='en', max_length=2),
        ),
        migrations.AddField(
            model_name='user',
            name='preferred_language',
            field=models.CharField(choices=[('en', 'English'), ('hi', 'Hindi'), ('mr', 'Marathi')], db_index=True, default='en', max_length=2),
        ),
    ]
