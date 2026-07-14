from django.contrib import admin
from .models import Plan, StoreSubscription, PaymentHistory, PlanFeature

class PlanFeatureInline(admin.TabularInline):
    model = PlanFeature
    extra = 1

@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ('name', 'price', 'razorpay_plan_id', 'is_active', 'created_at')
    search_fields = ('name', 'razorpay_plan_id')
    list_filter = ('is_active',)
    inlines = [PlanFeatureInline]

@admin.register(StoreSubscription)
class StoreSubscriptionAdmin(admin.ModelAdmin):
    list_display = ('store', 'plan', 'status', 'current_start', 'current_end', 'created_at')
    search_fields = ('store__name', 'razorpay_subscription_id', 'razorpay_payment_id')
    list_filter = ('status', 'plan')


@admin.register(PaymentHistory)
class PaymentHistoryAdmin(admin.ModelAdmin):
    list_display = ('store', 'subscription', 'amount', 'status', 'created_at')
    search_fields = ('store__name', 'razorpay_payment_id')
    list_filter = ('status',)