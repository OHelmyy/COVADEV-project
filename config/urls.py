"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import include, path
from django.shortcuts import redirect

def home(request):
    return redirect("projects/")
from django.urls import include, path

urlpatterns = [
    path("", home),
    path("admin/", admin.site.urls),

    # ✅ add this
    path("accounts/", include("apps.accounts.urls")),

    path("projects/", include("apps.projects.urls")),


    path("api/", include("apps.api.urls")),
]
