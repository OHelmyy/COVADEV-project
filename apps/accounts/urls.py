from django.urls import path
from . import views
from . import views_admin

app_name = "accounts"

urlpatterns = [
    # Auth
    path("login/", views.UserLoginView.as_view(), name="login"),
    path("logout/", views.UserLogoutView.as_view(), name="logout"),

    # Admin: Users CRUD
    path("admin/users/", views_admin.user_list, name="admin_user_list"),
    path("admin/users/create/", views_admin.user_create, name="admin_user_create"),
    path("admin/users/<int:user_id>/edit/", views_admin.user_edit, name="admin_user_edit"),
    path("admin/users/<int:user_id>/delete/", views_admin.user_delete, name="admin_user_delete"),
]
