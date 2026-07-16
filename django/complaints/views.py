from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser

from core.services.s3_service import get_file_url

from prescription.authentication import StoreTokenAuthentication, UserTokenAuthentication
from prescription.models import Store, User, PrescriptionResponse
from prescription.utils.app_notifications import (
    send_user_app_notification,
    send_store_app_notification,
)

from .models import Complaint, ComplaintMessage, ComplaintAttachment, ComplaintStatusHistory, PlatformSupportTicket, PlatformSupportMessage
from .serializers import (
    ComplaintCreateSerializer,
    ComplaintDetailSerializer,
    ComplaintListSerializer,
    ComplaintMessageSerializer,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def get_actor(request):
    """Return (actor_type, actor_instance) based on the authenticated token."""
    user = request.user
    if isinstance(user, Store):
        return 'store', user
    if isinstance(user, User):
        return 'user', user
    return None, None


def is_participant(complaint, actor_type, actor):
    if actor_type == 'user':
        if complaint.complainant_type == 'user' and complaint.complainant_user_id == actor.id:
            return True
        if complaint.respondent_type == 'user' and complaint.respondent_user_id == actor.id:
            return True
    if actor_type == 'store':
        if complaint.complainant_type == 'store' and complaint.complainant_store_id == actor.id:
            return True
        if complaint.respondent_type == 'store' and complaint.respondent_store_id == actor.id:
            return True
    return False


def notify_party(party_type, party, title, body, data=None, dedupe_key=None):
    if party_type == 'user' and party:
        return send_user_app_notification(party, title, body, data, notification_type='COMPLAINT', dedupe_key=dedupe_key)
    if party_type == 'store' and party:
        return send_store_app_notification(party, title, body, data, notification_type='COMPLAINT', dedupe_key=dedupe_key)
    return None


def _other_party(complaint, actor_type):
    """Return (party_type, party_instance) of the counterparty to `actor_type`."""
    if complaint.complainant_type != actor_type:
        ct = complaint.complainant_type
        party = complaint.complainant_store or complaint.complainant_user
    else:
        ct = complaint.respondent_type
        party = complaint.respondent_store or complaint.respondent_user
    return ct, party


def _log_status_change(complaint, old_status, new_status, changed_by, note=None):
    ComplaintStatusHistory.objects.create(
        complaint=complaint,
        from_status=old_status,
        to_status=new_status,
        changed_by=changed_by,
        note=note,
    )


def _validate_transition(old_status, new_status):
    allowed = Complaint.STATUS_TRANSITIONS.get(old_status, [])
    if new_status not in allowed:
        raise DjangoValidationError(
            f"Illegal status transition from '{old_status}' to '{new_status}'."
        )


# ---------------------------------------------------------------------------
# Platform (admin) permission: header-based shared secret
# ---------------------------------------------------------------------------
class IsPlatformAdmin(BasePermission):
    def has_permission(self, request, view):
        expected = getattr(settings, 'COMPLAINTS_PLATFORM_KEY', None)
        if not expected:
            return False
        return request.headers.get('X-Platform-Key') == expected


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------
class ComplaintCreateView(APIView):
    authentication_classes = [StoreTokenAuthentication, UserTokenAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @transaction.atomic
    def post(self, request):
        actor_type, actor = get_actor(request)
        if not actor:
            return Response({"error": "Unauthorized."}, status=401)

        serializer = ComplaintCreateSerializer(
            data=request.data,
            context={'request': request, 'actor': actor, 'actor_type': actor_type},
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data

        complaint = Complaint(
            complainant_type=actor_type,
            respondent_type=data['respondent_type'],
            category=data['category'],
            subject=data['subject'],
            description=data['description'],
            priority=data.get('priority', 'medium'),
        )

        if actor_type == 'user':
            complaint.complainant_user = actor
        else:
            complaint.complainant_store = actor

        if data['respondent_type'] == 'user':
            complaint.respondent_user = User.objects.get(id=data['respondent_id'])
        else:
            complaint.respondent_store = Store.objects.get(id=data['respondent_id'])

        order_id = data.get('order_id')
        if order_id:
            complaint.order = PrescriptionResponse.objects.filter(id=order_id).first()

        complaint.save()

        # Attachments
        for f in request.FILES.getlist('attachments'):
            ComplaintAttachment.objects.create(complaint=complaint, file=f)

        # Notify respondent
        r_type = complaint.respondent_type
        r_party = complaint.respondent_store or complaint.respondent_user
        notify_party(
            r_type, r_party,
            title="New complaint filed against you",
            body=f"{complaint.complainant.name if hasattr(complaint.complainant, 'name') else 'A user'} filed: {complaint.subject}",
            data={"complaint_id": complaint.id, "type": "COMPLAINT_NEW"},
            dedupe_key=f"complaint:{complaint.id}:new:{r_type}:{getattr(r_party, 'id', 0)}",
        )

        out = ComplaintDetailSerializer(complaint, context={'request': request, 'viewer': actor_type})
        return Response(out.data, status=201)


# ---------------------------------------------------------------------------
# List views
# ---------------------------------------------------------------------------
class _BaseComplaintListView(APIView):
    authentication_classes = [StoreTokenAuthentication, UserTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def _respond(self, request, queryset):
        actor_type, actor = get_actor(request)
        queryset = queryset.select_related(
            'complainant_user', 'complainant_store', 'respondent_user', 'respondent_store', 'order'
        )
        serializer = ComplaintListSerializer(
            queryset, many=True, context={'request': request, 'viewer': actor_type}
        )
        return Response(serializer.data, status=200)


class MyComplaintsView(_BaseComplaintListView):
    def get(self, request):
        actor_type, actor = get_actor(request)
        if actor_type == 'user':
            qs = Complaint.objects.filter(complainant_user=actor)
        else:
            qs = Complaint.objects.filter(complainant_store=actor)
        return self._respond(request, qs)


class ComplaintsAgainstView(_BaseComplaintListView):
    def get(self, request):
        actor_type, actor = get_actor(request)
        if actor_type == 'user':
            qs = Complaint.objects.filter(respondent_user=actor)
        else:
            qs = Complaint.objects.filter(respondent_store=actor)
        return self._respond(request, qs)


class ComplaintCountsView(APIView):
    authentication_classes = [StoreTokenAuthentication, UserTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        actor_type, actor = get_actor(request)
        if actor_type == 'user':
            filed = Complaint.objects.filter(complainant_user=actor).count()
            against = Complaint.objects.filter(respondent_user=actor)
        else:
            filed = Complaint.objects.filter(complainant_store=actor).count()
            against = Complaint.objects.filter(respondent_store=actor)

        open_statuses = ['open', 'under_review', 'awaiting_info']
        open_against = against.filter(status__in=open_statuses).count()

        return Response({
            "filed": filed,
            "against": against.count(),
            "open_against": open_against,
        }, status=200)


# ---------------------------------------------------------------------------
# Detail + thread
# ---------------------------------------------------------------------------
class ComplaintDetailView(APIView):
    authentication_classes = [StoreTokenAuthentication, UserTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, complaint_id):
        actor_type, actor = get_actor(request)
        try:
            complaint = Complaint.objects.select_related(
                'complainant_user', 'complainant_store',
                'respondent_user', 'respondent_store', 'order'
            ).prefetch_related('attachments', 'messages', 'status_history').get(id=complaint_id)
        except Complaint.DoesNotExist:
            return Response({"error": "Complaint not found."}, status=404)

        if not is_participant(complaint, actor_type, actor):
            return Response({"error": "You are not authorized to view this complaint."}, status=403)

        # Mark counterparty messages as read for this viewer
        ComplaintMessage.objects.filter(complaint=complaint, is_read=False).exclude(
            sender_type=actor_type
        ).update(is_read=True)

        serializer = ComplaintDetailSerializer(
            complaint, context={'request': request, 'viewer': actor_type}
        )
        return Response(serializer.data, status=200)


class ComplaintMessageView(APIView):
    authentication_classes = [StoreTokenAuthentication, UserTokenAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, complaint_id):
        actor_type, actor = get_actor(request)
        try:
            complaint = Complaint.objects.select_related(
                'complainant_user', 'complainant_store',
                'respondent_user', 'respondent_store'
            ).get(id=complaint_id)
        except Complaint.DoesNotExist:
            return Response({"error": "Complaint not found."}, status=404)

        if not is_participant(complaint, actor_type, actor):
            return Response({"error": "You are not authorized to message on this complaint."}, status=403)

        if complaint.is_terminal:
            return Response({"error": "This complaint is closed. No further replies allowed."}, status=400)

        text = (request.data.get('text') or '').strip()
        attachment = request.FILES.get('attachment')
        if not text and not attachment:
            return Response({"error": "Message text or attachment is required."}, status=400)

        message = ComplaintMessage.objects.create(
            complaint=complaint,
            sender_type=actor_type,
            text=text or None,
            attachment=attachment,
            is_read=False,
        )
        if actor_type == 'user':
            message.sender_user = actor
        else:
            message.sender_store = actor
        message.save()

        # Notify the other party
        o_type, o_party = _other_party(complaint, actor_type)
        notify_party(
            o_type, o_party,
            title="New reply on your complaint",
            body=text[:120] if text else "Sent you an attachment",
            data={"complaint_id": complaint.id, "type": "COMPLAINT_REPLY"},
            dedupe_key=f"complaint:{complaint.id}:reply:{o_type}:{getattr(o_party, 'id', 0)}:{message.id}",
        )

        serializer = ComplaintMessageSerializer(message, context={'request': request})
        return Response(serializer.data, status=201)


class ComplaintWithdrawView(APIView):
    authentication_classes = [StoreTokenAuthentication, UserTokenAuthentication]
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, complaint_id):
        actor_type, actor = get_actor(request)
        try:
            complaint = Complaint.objects.select_related(
                'complainant_user', 'complainant_store',
                'respondent_user', 'respondent_store'
            ).get(id=complaint_id)
        except Complaint.DoesNotExist:
            return Response({"error": "Complaint not found."}, status=404)

        if actor_type != complaint.complainant_type:
            return Response({"error": "Only the complainant can withdraw this complaint."}, status=403)

        if complaint.complainant_type == 'user' and complaint.complainant_user_id != actor.id:
            return Response({"error": "Only the complainant can withdraw this complaint."}, status=403)
        if complaint.complainant_type == 'store' and complaint.complainant_store_id != actor.id:
            return Response({"error": "Only the complainant can withdraw this complaint."}, status=403)

        if complaint.status not in ('open', 'under_review', 'awaiting_info'):
            return Response({"error": "This complaint can no longer be withdrawn."}, status=400)

        old_status = complaint.status
        try:
            _validate_transition(old_status, 'withdrawn')
        except DjangoValidationError as e:
            return Response({"error": str(e)}, status=400)

        complaint.status = 'withdrawn'
        complaint.resolution_notes = request.data.get('reason') or 'Withdrawn by complainant.'
        complaint.resolved_at = timezone.now()
        complaint.save()
        _log_status_change(complaint, old_status, 'withdrawn', actor_type, note=complaint.resolution_notes)

        # Notify respondent
        o_type, o_party = _other_party(complaint, actor_type)
        notify_party(
            o_type, o_party,
            title="Complaint withdrawn",
            body=f"Complaint #{complaint.id} was withdrawn by the complainant.",
            data={"complaint_id": complaint.id, "type": "COMPLAINT_STATUS"},
            dedupe_key=f"complaint:{complaint.id}:withdrawn:{o_type}:{getattr(o_party, 'id', 0)}",
        )

        serializer = ComplaintDetailSerializer(
            complaint, context={'request': request, 'viewer': actor_type}
        )
        return Response(serializer.data, status=200)


# ---------------------------------------------------------------------------
# Platform (admin) resolution endpoints
# ---------------------------------------------------------------------------
class ComplaintPlatformListView(APIView):
    authentication_classes = [StoreTokenAuthentication, UserTokenAuthentication]
    permission_classes = [IsPlatformAdmin]

    def get(self, request):
        status_filter = request.query_params.get('status')
        qs = Complaint.objects.select_related(
            'complainant_user', 'complainant_store',
            'respondent_user', 'respondent_store', 'order'
        ).all()
        if status_filter:
            qs = qs.filter(status=status_filter)
        serializer = ComplaintListSerializer(qs, many=True, context={'request': request, 'viewer': None})
        return Response(serializer.data, status=200)


class ComplaintPlatformActionView(APIView):
    authentication_classes = [StoreTokenAuthentication, UserTokenAuthentication]
    permission_classes = [IsPlatformAdmin]

    @transaction.atomic
    def post(self, request, complaint_id):
        try:
            complaint = Complaint.objects.select_related(
                'complainant_user', 'complainant_store',
                'respondent_user', 'respondent_store'
            ).get(id=complaint_id)
        except Complaint.DoesNotExist:
            return Response({"error": "Complaint not found."}, status=404)

        new_status = request.data.get('status')
        if new_status and new_status not in dict(Complaint.STATUS_CHOICES):
            return Response({"error": "Invalid status."}, status=400)

        old_status = complaint.status
        if new_status and new_status != old_status:
            try:
                _validate_transition(old_status, new_status)
            except DjangoValidationError as e:
                return Response({"error": str(e)}, status=400)
            complaint.status = new_status
            if new_status in ('resolved', 'rejected', 'withdrawn', 'closed'):
                complaint.resolved_at = timezone.now()
            _log_status_change(complaint, old_status, new_status, 'platform',
                               note=request.data.get('note'))

        if 'assigned_to' in request.data:
            complaint.assigned_to = request.data.get('assigned_to') or None
        if 'resolution_notes' in request.data:
            complaint.resolution_notes = request.data.get('resolution_notes') or None

        complaint.save()

        # Notify both parties
        for ptype, party in [
            (complaint.complainant_type, complaint.complainant_store or complaint.complainant_user),
            (complaint.respondent_type, complaint.respondent_store or complaint.respondent_user),
        ]:
            notify_party(
                ptype, party,
                title="Complaint update",
                body=f"Your complaint #{complaint.id} is now '{complaint.get_status_display()}'.",
                data={"complaint_id": complaint.id, "type": "COMPLAINT_STATUS"},
                dedupe_key=f"complaint:{complaint.id}:status:{ptype}:{getattr(party, 'id', 0)}",
            )

        serializer = ComplaintDetailSerializer(complaint, context={'request': request, 'viewer': None})
        return Response(serializer.data, status=200)


# ---------------------------------------------------------------------------
# Platform support (separate from user/store complaints)
# ---------------------------------------------------------------------------
def _support_ticket_for_actor(ticket_id, actor_type, actor):
    filters = {'id': ticket_id}
    filters['requester_user' if actor_type == 'user' else 'requester_store'] = actor
    return PlatformSupportTicket.objects.filter(**filters).first()


def _file_url(request, field):
    return get_file_url(field, request)


def _serialize_support_ticket(request, ticket, detail=False):
    actor_type, _ = get_actor(request)
    data = {
        'id': ticket.id,
        'category': ticket.category,
        'category_display': ticket.get_category_display(),
        'subject': ticket.subject,
        'description': ticket.description,
        'priority': ticket.priority,
        'priority_display': ticket.get_priority_display(),
        'status': ticket.status,
        'status_display': ticket.get_status_display(),
        'assigned_to': ticket.assigned_to or None,
        'resolution_note': ticket.resolution_note or None,
        'resolved_at': ticket.resolved_at,
        'created_at': ticket.created_at,
        'updated_at': ticket.updated_at,
        'message_count': ticket.messages.count(),
        'unread_count': ticket.messages.filter(is_read=False).exclude(sender_type=actor_type).count(),
    }
    if detail:
        data['messages'] = [{
            'id': message.id,
            'sender_type': message.sender_type,
            'sender_name': (
                message.sender_store.name if message.sender_store
                else message.sender_user.name if message.sender_user
                else 'AARX Support'
            ),
            'text': message.text,
            'attachment': _file_url(request, message.attachment),
            'is_read': message.is_read,
            'created_at': message.created_at,
        } for message in ticket.messages.select_related('sender_user', 'sender_store').all()]
    return data


class PlatformSupportTicketListCreateView(APIView):
    authentication_classes = [StoreTokenAuthentication, UserTokenAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        actor_type, actor = get_actor(request)
        if not actor:
            return Response({'error': 'Unauthorized.'}, status=401)
        key = 'requester_user' if actor_type == 'user' else 'requester_store'
        tickets = PlatformSupportTicket.objects.filter(**{key: actor}).prefetch_related('messages')
        return Response([_serialize_support_ticket(request, ticket) for ticket in tickets])

    @transaction.atomic
    def post(self, request):
        actor_type, actor = get_actor(request)
        if not actor:
            return Response({'error': 'Unauthorized.'}, status=401)
        category = str(request.data.get('category', '')).strip()
        subject = str(request.data.get('subject', '')).strip()
        description = str(request.data.get('description', '')).strip()
        priority = str(request.data.get('priority', 'medium')).strip()
        errors = {}
        if category not in dict(PlatformSupportTicket.CATEGORY_CHOICES):
            errors['category'] = ['Select a valid issue type.']
        if len(subject) < 4:
            errors['subject'] = ['Subject must be at least 4 characters.']
        if len(description) < 10:
            errors['description'] = ['Please describe the issue in at least 10 characters.']
        if priority not in dict(PlatformSupportTicket.PRIORITY_CHOICES):
            errors['priority'] = ['Select a valid priority.']
        if errors:
            return Response(errors, status=400)

        kwargs = {
            'requester_type': actor_type, 'category': category, 'subject': subject,
            'description': description, 'priority': priority,
            'requester_user' if actor_type == 'user' else 'requester_store': actor,
        }
        ticket = PlatformSupportTicket.objects.create(**kwargs)
        attachment = request.FILES.get('attachment')
        if attachment:
            message_kwargs = {'ticket': ticket, 'sender_type': actor_type, 'attachment': attachment}
            message_kwargs['sender_user' if actor_type == 'user' else 'sender_store'] = actor
            PlatformSupportMessage.objects.create(**message_kwargs)
        return Response(_serialize_support_ticket(request, ticket, detail=True), status=201)


class PlatformSupportTicketDetailView(APIView):
    authentication_classes = [StoreTokenAuthentication, UserTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, ticket_id):
        actor_type, actor = get_actor(request)
        ticket = _support_ticket_for_actor(ticket_id, actor_type, actor)
        if not ticket:
            return Response({'error': 'Support request not found.'}, status=404)
        ticket.messages.filter(is_read=False).exclude(sender_type=actor_type).update(is_read=True)
        return Response(_serialize_support_ticket(request, ticket, detail=True))


class PlatformSupportMessageView(APIView):
    authentication_classes = [StoreTokenAuthentication, UserTokenAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @transaction.atomic
    def post(self, request, ticket_id):
        actor_type, actor = get_actor(request)
        ticket = _support_ticket_for_actor(ticket_id, actor_type, actor)
        if not ticket:
            return Response({'error': 'Support request not found.'}, status=404)
        if ticket.status == 'closed':
            return Response({'error': 'This support request is closed.'}, status=400)
        text = str(request.data.get('text', '')).strip()
        attachment = request.FILES.get('attachment')
        if not text and not attachment:
            return Response({'error': 'Write a message or attach a file.'}, status=400)
        kwargs = {'ticket': ticket, 'sender_type': actor_type, 'text': text, 'attachment': attachment}
        kwargs['sender_user' if actor_type == 'user' else 'sender_store'] = actor
        PlatformSupportMessage.objects.create(**kwargs)
        if ticket.status == 'resolved':
            ticket.status = 'open'
            ticket.resolved_at = None
        ticket.save(update_fields=['status', 'resolved_at', 'updated_at'])
        return Response(_serialize_support_ticket(request, ticket, detail=True), status=201)
