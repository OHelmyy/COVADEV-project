# apps/api/admin_users_urls.py
from django.urls import path
from . import admin_users_views ,admin_dashboard_views

urlpatterns = [
    path("users/", admin_users_views.users_list_create),
    path("users/<int:user_id>/", admin_users_views.users_update_delete),
    path("dashboard/", admin_dashboard_views.admin_dashboard),

]