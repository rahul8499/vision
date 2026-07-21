import uuid
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('prescription', '0107_appnotification_push_delivery')]

    operations = [
        migrations.AddField(model_name='storedeliveryperson', name='login_id', field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
        migrations.AddField(model_name='storedeliveryperson', name='pin_hash', field=models.CharField(blank=True, max_length=255)),
        migrations.AddField(model_name='storedeliveryperson', name='auth_token', field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
        migrations.AddField(model_name='storedeliveryperson', name='last_login_at', field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name='prescriptionresponse', name='delivery_picked_up_at', field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name='prescriptionresponse', name='delivery_reached_at', field=models.DateTimeField(blank=True, null=True)),
    ]
