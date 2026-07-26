from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('prescription', '0116_rename_prescr_cat_act_cr_6d1e6a_idx_prescriptio_categor_e3fd3b_idx_and_more')]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='name',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AlterField(
            model_name='user',
            name='email',
            field=models.EmailField(blank=True, max_length=254, null=True, unique=True),
        ),
        migrations.AlterField(
            model_name='user',
            name='password',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AlterField(
            model_name='user',
            name='address',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AlterField(
            model_name='user',
            name='pincode',
            field=models.CharField(blank=True, default='', max_length=10),
        ),
    ]
