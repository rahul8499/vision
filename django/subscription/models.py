from django.db import models
from django.utils import timezone
from prescription.models import Store

class Plan(models.Model):
    name = models.CharField(max_length=100)
    razorpay_plan_id = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} - ₹{self.price}"

class StoreSubscription(models.Model):
    STATUS_CHOICES = [
        ('created', 'Created'),
        ('authenticated', 'Authenticated'),
        ('active', 'Active'),
        ('pending', 'Pending'),
        ('halted', 'Halted'),
        ('cancelled', 'Cancelled'),
        ('completed', 'Completed'),
        ('expired', 'Expired'),
    ]

    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='subscriptions')
    plan = models.ForeignKey(Plan, on_delete=models.SET_NULL, null=True)
    razorpay_subscription_id = models.CharField(max_length=100, unique=True)
    razorpay_payment_id = models.CharField(max_length=100, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='created')
    current_start = models.IntegerField(null=True, blank=True)
    current_end = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Subscription {self.razorpay_subscription_id} for {self.store.name} - {self.status}"
