from django.apps import AppConfig


class VenuesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "venues"
    verbose_name = "Fitness rooms"

    def ready(self):
        from django.contrib import admin
        from django.utils.translation import gettext_lazy as _

        admin.site.site_header = _("LCSD fitness room database")
        admin.site.site_title = _("LCSD fitness rooms")
        admin.site.index_title = _("Database tables")
