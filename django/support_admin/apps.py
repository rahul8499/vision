from django.apps import AppConfig


class SupportAdminConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'support_admin'
    verbose_name = 'Support Admin'

    def ready(self):
        import support_admin.signals  # noqa: F401
