from django.apps import AppConfig

class AnalysisConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.analysis"
    
    def ready(self):
        # Import signals so the @receiver decorators get registered.
        from apps.analysis import signals  # noqa: F401