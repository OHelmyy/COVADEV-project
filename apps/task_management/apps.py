from django.apps import AppConfig


class TaskManagementConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.task_management"
    
    def ready(self):
        # Import signals so the @receiver decorators get registered.
        from apps.task_management import signals  # noqa: F401
        