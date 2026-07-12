# Generated for repeat customer and order-again support.

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('prescription', '0089_user_store_lifecycle_flags'),
    ]

    operations = [
        migrations.AddField(
            model_name='prescription',
            name='preferred_store',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='preferred_reorder_prescriptions', to='prescription.store'),
        ),
        migrations.AddField(
            model_name='prescription',
            name='reorder_scope',
            field=models.CharField(choices=[('none', 'None'), ('preferred_only', 'Preferred Store Only'), ('all_stores', 'All Eligible Stores')], db_index=True, default='none', max_length=20),
        ),
        migrations.AddField(
            model_name='prescription',
            name='source_response',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reorder_prescriptions', to='prescription.prescriptionresponse'),
        ),
        migrations.CreateModel(
            name='UserStoreRelationship',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('completed_order_count', models.PositiveIntegerField(default=0)),
                ('last_order_at', models.DateTimeField(db_index=True, null=True, blank=True)),
                ('is_preferred', models.BooleanField(db_index=True, default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('last_completed_order', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='last_relationship_records', to='prescription.prescriptionresponse')),
                ('store', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='user_relationships', to='prescription.store')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='store_relationships', to='prescription.user')),
            ],
            options={
                'unique_together': {('user', 'store')},
            },
        ),
        migrations.CreateModel(
            name='SavedMedicine',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('medicine_name', models.CharField(max_length=255)),
                ('medicine_brand', models.CharField(blank=True, max_length=255, null=True)),
                ('medicine_type', models.CharField(default='brand', max_length=20)),
                ('last_price', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ('last_ordered_at', models.DateTimeField(db_index=True, null=True, blank=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('source_response', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='saved_medicine_snapshots', to='prescription.prescriptionresponse')),
                ('store', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='saved_customer_medicines', to='prescription.store')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='saved_medicines', to='prescription.user')),
            ],
            options={
                'unique_together': {('user', 'medicine_name', 'medicine_brand', 'medicine_type')},
            },
        ),
        migrations.AddIndex(
            model_name='userstorerelationship',
            index=models.Index(fields=['user', 'is_preferred', 'last_order_at'], name='prescriptio_user_id_ac0761_idx'),
        ),
        migrations.AddIndex(
            model_name='userstorerelationship',
            index=models.Index(fields=['store', 'completed_order_count'], name='prescriptio_store_i_0f7b57_idx'),
        ),
        migrations.AddIndex(
            model_name='savedmedicine',
            index=models.Index(fields=['user', 'is_active', 'last_ordered_at'], name='prescriptio_user_id_ccc4a1_idx'),
        ),
    ]
