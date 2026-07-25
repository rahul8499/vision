from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('prescription', '0114_prescription_ocr_suggestions'),
    ]

    operations = [
        migrations.CreateModel(
            name='ActivityLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('category', models.CharField(db_index=True, max_length=40)),
                ('action', models.CharField(db_index=True, max_length=60)),
                ('actor_type', models.CharField(blank=True, default='', max_length=30)),
                ('actor_id', models.CharField(blank=True, default='', max_length=64)),
                ('subject_type', models.CharField(blank=True, default='', max_length=60)),
                ('subject_id', models.CharField(blank=True, default='', max_length=64)),
                ('title', models.CharField(max_length=180)),
                ('details', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='activitylog',
            index=models.Index(fields=['category', 'action', 'created_at'], name='prescr_cat_act_cr_6d1e6a_idx'),
        ),
        migrations.AddIndex(
            model_name='activitylog',
            index=models.Index(fields=['subject_type', 'subject_id', 'created_at'], name='prescr_subj_typ_9b0e24_idx'),
        ),
        migrations.AddIndex(
            model_name='activitylog',
            index=models.Index(fields=['actor_type', 'actor_id', 'created_at'], name='prescr_act_typ_a6c01f_idx'),
        ),
    ]
