import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create or update the admin user from DJANGO_SUPERUSER_* environment variables."

    def handle(self, *args, **options):
        username = os.environ.get("DJANGO_SUPERUSER_USERNAME", "").strip()
        password = os.environ.get("DJANGO_SUPERUSER_PASSWORD", "")
        email = os.environ.get("DJANGO_SUPERUSER_EMAIL", "admin@example.com")
        if not username or not password:
            self.stdout.write("DJANGO_SUPERUSER_USERNAME or PASSWORD is empty; skipping.")
            return
        user_model = get_user_model()
        user, created = user_model.objects.get_or_create(
            username=username,
            defaults={"email": email, "is_staff": True, "is_superuser": True},
        )
        user.email = email
        user.is_staff = True
        user.is_superuser = True
        if created or not user.check_password(password):
            user.set_password(password)
        user.save()
        self.stdout.write(f"Superuser ready: {username}")
