from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


def dedupe_target_stores(apps, schema_editor):
    PrescriptionTargetStore = apps.get_model('prescription', 'PrescriptionTargetStore')
    seen = set()
    duplicate_ids = []

    rows = PrescriptionTargetStore.objects.order_by('prescription_id', 'store_id', 'id').values(
        'id', 'prescription_id', 'store_id'
    )
    for row in rows.iterator():
        key = (row['prescription_id'], row['store_id'])
        if key in seen:
            duplicate_ids.append(row['id'])
        else:
            seen.add(key)

    if duplicate_ids:
        PrescriptionTargetStore.objects.filter(id__in=duplicate_ids).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('prescription', '0086_prescriptionresponse_completed_by_store_deliveryotp'),
    ]

    operations = [
        migrations.AddField(
            model_name='prescription',
            name='dispatch_batch_size',
            field=models.IntegerField(default=20),
        ),
        migrations.AddField(
            model_name='prescription',
            name='dispatch_completed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='prescription',
            name='dispatch_current_batch',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='prescription',
            name='dispatch_min_quotes',
            field=models.IntegerField(default=3),
        ),
        migrations.AddField(
            model_name='prescription',
            name='dispatch_next_check_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='prescription',
            name='dispatch_status',
            field=models.CharField(choices=[('pending', 'Pending'), ('active', 'Active'), ('completed', 'Completed'), ('exhausted', 'Exhausted')], db_index=True, default='pending', max_length=20),
        ),
        migrations.AddField(
            model_name='prescriptiontargetstore',
            name='batch_number',
            field=models.IntegerField(db_index=True, default=1),
        ),
        migrations.AddField(
            model_name='prescriptiontargetstore',
            name='distance_km',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True),
        ),
        migrations.AddField(
            model_name='prescriptiontargetstore',
            name='notified_at',
            field=models.DateTimeField(db_index=True, default=django.utils.timezone.now),
        ),
        migrations.AddField(
            model_name='prescriptiontargetstore',
            name='rank_score',
            field=models.DecimalField(decimal_places=4, default=0.0, max_digits=7),
        ),
        migrations.AddField(
            model_name='prescriptiontargetstore',
            name='responded_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='prescriptiontargetstore',
            name='status',
            field=models.CharField(choices=[('notified', 'Notified'), ('responded', 'Responded'), ('skipped', 'Skipped')], db_index=True, default='notified', max_length=20),
        ),
        migrations.RunPython(dedupe_target_stores, migrations.RunPython.noop),
        migrations.AlterUniqueTogether(
            name='prescriptiontargetstore',
            unique_together={('prescription', 'store')},
        ),
        migrations.AddIndex(
            model_name='prescriptiontargetstore',
            index=models.Index(fields=['prescription', 'batch_number'], name='prescriptio_prescri_082fe6_idx'),
        ),
        migrations.AddIndex(
            model_name='prescriptiontargetstore',
            index=models.Index(fields=['store', 'status'], name='prescriptio_store_i_710eae_idx'),
        ),
    ]
