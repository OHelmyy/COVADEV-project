from django.contrib.auth.models import User

AI_AGENT_USERNAME = "Mr.Rambo"
AI_AGENT_EMAIL = "MrRamboAi@covadev.local"


def get_or_create_ai_user() -> User:
    """
    Returns the shared system User that represents the AI agent.
    Creates it on first call. The user is marked unusable so nobody
    can log in as it.
    """
    user, created = User.objects.get_or_create(
        username=AI_AGENT_USERNAME,
        defaults={
            "email": AI_AGENT_EMAIL,
            "first_name": "AI",
            "last_name": "Agent",
            "is_active": False,
        },
    )
    if created:
        user.set_unusable_password()
        user.save()
    return user