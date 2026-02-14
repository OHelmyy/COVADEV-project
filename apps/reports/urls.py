# apps/api/reports_urls.py
from django.urls import path
from apps.analysis.api_views import dashboard_stats

urlpatterns = [
    path("dashboard/", dashboard_stats, name="dashboard_stats"),
]
