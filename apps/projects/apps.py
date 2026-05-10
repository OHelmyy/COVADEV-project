from django.apps import AppConfig


class ProjectsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.projects"

    def ready(self):
        # Import signals so the @receiver decorators get registered.
        from apps.projects import signals  # noqa: F401
