# apps/api/auth_urls.py
from django.urls import path
from . import auth_views

urlpatterns = [
    path("me/", auth_views.me, name="me"),
    path("login/", auth_views.login_view, name="login"),
    path("logout/", auth_views.logout_view, name="logout"),
]