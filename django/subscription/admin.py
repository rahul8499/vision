from django.contrib import admin
from .models import Plan, StoreSubscription

@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ('name', 'price', 'razorpay_plan_id', 'is_active', 'created_at')
    search_fields = ('name', 'razorpay_plan_id')
    list_filter = ('is_active',)

@admin.register(StoreSubscription)
class StoreSubscriptionAdmin(admin.ModelAdmin):
    list_display = ('store', 'plan', 'status', 'current_start', 'current_end', 'created_at')
    search_fields = ('store__name', 'razorpay_subscription_id', 'razorpay_payment_id')
    list_filter = ('status', 'plan')
