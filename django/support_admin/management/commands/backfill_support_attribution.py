from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction

from complaints.models import ComplaintMessage, ComplaintStatusHistory, PlatformSupportMessage, PlatformSupportTicketStatusHistory
from support_admin.models import SupportAuditLog


class Command(BaseCommand):
    help = "Backfill legacy attribution by matching explicit staff audit actions to records created immediately before them."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Persist high-confidence matches; default is dry-run.")

    @transaction.atomic
    def handle(self, *args, **options):
        apply_changes = options["apply"]
        matched = {"complaint_messages": 0, "complaint_statuses": 0, "ticket_messages": 0, "ticket_statuses": 0}
        rules = {
            "reply_complaint": (ComplaintMessage, "complaint_id", "support_staff", "complaint_messages", {"sender_type": "platform"}),
            "update_complaint_status": (ComplaintStatusHistory, "complaint_id", "changed_by_staff", "complaint_statuses", {}),
            "reply_ticket": (PlatformSupportMessage, "ticket_id", "support_staff", "ticket_messages", {"sender_type": "platform"}),
            "update_ticket_status": (PlatformSupportTicketStatusHistory, "ticket_id", "changed_by_staff", "ticket_statuses", {}),
        }
        logs = SupportAuditLog.objects.filter(action__in=rules, actor__isnull=False).select_related("actor").order_by("created_at")
        for log in logs.iterator():
            model, case_field, staff_field, counter, extra = rules[log.action]
            filters = {
                case_field: log.entity_id,
                f"{staff_field}__isnull": True,
                "created_at__lte": log.created_at,
                "created_at__gte": log.created_at - timedelta(seconds=60),
                **extra,
            }
            candidate = model.objects.filter(**filters).order_by("-created_at").first()
            if not candidate:
                continue
            matched[counter] += 1
            if apply_changes:
                setattr(candidate, staff_field, log.actor)
                candidate.save(update_fields=[staff_field])
        if not apply_changes:
            transaction.set_rollback(True)
        mode = "APPLIED" if apply_changes else "DRY RUN"
        self.stdout.write(self.style.SUCCESS(f"{mode}: {matched}"))
        if not apply_changes:
            self.stdout.write("Only explicit audit actions within 60 seconds are eligible. Rerun with --apply after review.")
