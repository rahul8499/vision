import hmac
import hashlib
import json
import logging
import razorpay
from django.conf import settings
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from prescription.authentication import StoreTokenAuthentication
from .models import Plan, StoreSubscription, PaymentHistory
from prescription.models import Store

logger = logging.getLogger(__name__)

client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))

class AvailablePlansView(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request):
        plans_qs = Plan.objects.filter(is_active=True).prefetch_related('features')
        plans = []
        for plan in plans_qs:
            features = list(plan.features.filter(is_active=True).values_list('name', flat=True))
            plans.append({
                'id': plan.id,
                'name': plan.name,
                'razorpay_plan_id': plan.razorpay_plan_id,
                'description': plan.description,
                'price': plan.price,
                'features': features
            })
        return Response({'plans': plans}, status=status.HTTP_200_OK)

class CurrentSubscriptionView(APIView):
    authentication_classes = [StoreTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not getattr(request.user, 'is_store', False):
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            # Get the most recent active or created subscription
            sub = StoreSubscription.objects.filter(store=request.user).exclude(status__in=['cancelled', 'expired']).latest('created_at')
            return Response({
                'subscription_id': sub.razorpay_subscription_id,
                'status': sub.status,
                'plan_name': sub.plan.name if sub.plan else None,
                'current_start': sub.current_start,
                'current_end': sub.current_end,
            }, status=status.HTTP_200_OK)
        except StoreSubscription.DoesNotExist:
            return Response({'subscription': None}, status=status.HTTP_200_OK)


class CreateSubscriptionView(APIView):
    authentication_classes = [StoreTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not getattr(request.user, 'is_store', False):
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        plan_id = request.data.get('plan_id')
        if not plan_id:
            return Response({'error': 'Plan ID is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            plan = Plan.objects.get(id=plan_id, is_active=True)
        except Plan.DoesNotExist:
            return Response({'error': 'Invalid Plan'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check for existing active subscription to prevent duplicate billing
        active_sub = StoreSubscription.objects.filter(
            store=request.user, 
            status__in=['active', 'created', 'authenticated']
        ).first()
        
        if active_sub:
            # Same plan, same status = already active, no need to do anything
            if active_sub.plan == plan and active_sub.status == 'active':
                return Response({
                    'error': 'You already have an active subscription.',
                    'subscription_id': active_sub.razorpay_subscription_id
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Same plan, pending checkout = resume
            if active_sub.plan == plan and active_sub.status in ['created', 'authenticated']:
                return Response({
                    'subscription_id': active_sub.razorpay_subscription_id,
                    'message': 'Resuming existing checkout.'
                }, status=status.HTTP_200_OK)
            
            # PLAN UPGRADE or plan change: cancel old subscription and create new one
            logger.info(f"Plan upgrade requested (store_id: {request.user.id}, old_plan: {active_sub.plan_id}, new_plan: {plan.id})")
            try:
                # Cancel old subscription on Razorpay (at end of billing cycle)
                client.subscription.cancel(active_sub.razorpay_subscription_id, {"cancel_at_cycle_end": 0})
                logger.info(f"Old subscription cancelled on Razorpay: {active_sub.razorpay_subscription_id}")
            except Exception as cancel_err:
                logger.warning(f"Could not cancel old subscription on Razorpay: {cancel_err}")
            
            # Mark old as cancelled locally
            active_sub.status = 'cancelled'
            active_sub.save()
            
        try:
            # Create new Razorpay subscription
            razorpay_sub = client.subscription.create({
                "plan_id": plan.razorpay_plan_id,
                "customer_notify": 1,
                "total_count": 12 # 12 billing cycles (1 year)
            })
            
            sub = StoreSubscription.objects.create(
                store=request.user,
                plan=plan,
                razorpay_subscription_id=razorpay_sub['id'],
                status='created'
            )
            logger.info(f"Subscription created (store_id: {request.user.id}, sub_id: {razorpay_sub['id']})")
            
            return Response({
                'subscription_id': sub.razorpay_subscription_id
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error creating subscription: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class VerifyPaymentView(APIView):
    authentication_classes = [StoreTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not getattr(request.user, 'is_store', False):
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        razorpay_payment_id = request.data.get('razorpay_payment_id')
        razorpay_subscription_id = request.data.get('razorpay_subscription_id')
        razorpay_signature = request.data.get('razorpay_signature')
        
        if not all([razorpay_payment_id, razorpay_subscription_id, razorpay_signature]):
            return Response({'error': 'Missing parameters'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            # Verify signature using Razorpay utility
            client.utility.verify_subscription_payment_signature({
                'razorpay_subscription_id': razorpay_subscription_id,
                'razorpay_payment_id': razorpay_payment_id,
                'razorpay_signature': razorpay_signature
            })
            
            sub = StoreSubscription.objects.get(razorpay_subscription_id=razorpay_subscription_id)
            sub.razorpay_payment_id = razorpay_payment_id
            
            # Fetch latest details to update start/end dates
            r_sub = client.subscription.fetch(razorpay_subscription_id)
            sub.status = r_sub.get('status', 'active')
            sub.current_start = r_sub.get('current_start')
            sub.current_end = r_sub.get('current_end')
            sub.save()
            
            # Record payment history
            payment = client.payment.fetch(razorpay_payment_id)
            PaymentHistory.objects.update_or_create(
                razorpay_payment_id=razorpay_payment_id,
                defaults={
                    'store': request.user,
                    'subscription': sub,
                    'amount': payment.get('amount', 0) / 100, # convert from paise
                    'status': payment.get('status', 'captured')
                }
            )

            logger.info(f"Payment verified (sub_id: {razorpay_subscription_id})")
            return Response({'message': 'Payment verified successfully'}, status=status.HTTP_200_OK)
            
        except razorpay.errors.SignatureVerificationError:
            logger.error(f"Webhook verification failed for payment {razorpay_payment_id}")
            return Response({'error': 'Invalid signature'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class SyncSubscriptionView(APIView):
    authentication_classes = [StoreTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not getattr(request.user, 'is_store', False):
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
            
        razorpay_subscription_id = request.data.get('subscription_id')
        if not razorpay_subscription_id:
            return Response({'error': 'Subscription ID is required'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            sub = StoreSubscription.objects.get(razorpay_subscription_id=razorpay_subscription_id, store=request.user)
            r_sub = client.subscription.fetch(razorpay_subscription_id)
            
            sub.status = r_sub.get('status', sub.status)
            sub.current_start = r_sub.get('current_start')
            sub.current_end = r_sub.get('current_end')
            sub.save()
            
            return Response({
                'status': sub.status,
                'current_start': sub.current_start,
                'current_end': sub.current_end
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class RazorpayWebhookView(APIView):
    authentication_classes = [] # Webhooks don't use standard auth
    permission_classes = []

    def post(self, request):
        webhook_signature = request.META.get('HTTP_X_RAZORPAY_SIGNATURE')
        payload = request.body.decode('utf-8')
        
        try:
            client.utility.verify_webhook_signature(payload, webhook_signature, settings.RAZORPAY_WEBHOOK_SECRET)
        except Exception as e:
            logger.error("Webhook verification failed")
            return Response({'error': 'Invalid signature'}, status=status.HTTP_400_BAD_REQUEST)
            
        data = json.loads(payload)
        event = data.get('event')
        logger.info(f"Webhook received (event: {event})")
        
        try:
            if event in ['subscription.activated', 'subscription.charged', 'subscription.completed', 'subscription.cancelled', 'subscription.halted']:
                sub_payload = data['payload']['subscription']['entity']
                sub_id = sub_payload['id']
                
                try:
                    sub = StoreSubscription.objects.get(razorpay_subscription_id=sub_id)
                    sub.status = sub_payload.get('status', sub.status)
                    sub.current_start = sub_payload.get('current_start')
                    sub.current_end = sub_payload.get('current_end')
                    sub.save()
                    
                    if event == 'subscription.activated':
                        logger.info(f"Subscription activated (sub_id: {sub_id})")
                    elif event == 'subscription.charged':
                        logger.info(f"Subscription renewed (sub_id: {sub_id}, new_end: {sub.current_end})")
                    elif event == 'subscription.cancelled':
                        logger.info(f"Subscription cancelled (sub_id: {sub_id})")
                        
                except StoreSubscription.DoesNotExist:
                    logger.warning(f"Webhook received for unknown subscription: {sub_id}")
                    
            return Response({'status': 'ok'}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error processing webhook: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class PaymentHistoryView(APIView):
    authentication_classes = [StoreTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not getattr(request.user, 'is_store', False):
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
            
        history = PaymentHistory.objects.filter(store=request.user).order_by('-created_at').values(
            'id', 'razorpay_payment_id', 'amount', 'status', 'created_at', 'subscription__plan__name'
        )
        return Response({'history': list(history)}, status=status.HTTP_200_OK)

