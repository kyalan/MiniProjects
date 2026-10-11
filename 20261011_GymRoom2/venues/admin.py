from django.contrib import admin
from django.contrib.gis import admin as gis_admin

from .models import Equipment, OpeningSlot, SyncRun, TimetableMeta, Venue, VenueRoom


class VenueRoomInline(admin.TabularInline):
    model = VenueRoom
    extra = 0


class EquipmentInline(admin.TabularInline):
    model = Equipment
    extra = 0
    fields = ("room_no", "name_en", "name_hant", "name_hans", "quantity", "shared_use")
    show_change_link = True


class TimetableMetaInline(admin.TabularInline):
    model = TimetableMeta
    extra = 0
    can_delete = False
    readonly_fields = (
        "room_no",
        "year",
        "month",
        "hourly_quota",
        "monthly_quota",
        "issued_on",
        "source_updated_on",
        "source_url",
        "file_sha256",
        "error",
    )


@admin.register(Venue)
class VenueAdmin(gis_admin.GISModelAdmin):
    default_lon = 114.15
    default_lat = 22.32
    default_zoom = 11
    list_display = (
        "name_en",
        "name_hant",
        "district_en",
        "region",
        "phone",
        "size_text_en",
        "location_quality",
        "accessible_equipment",
        "lcsd_detail_id",
        "updated_at",
    )
    list_filter = ("region", "district_en", "location_quality", "accessible_equipment")
    search_fields = ("name_en", "name_hant", "name_hans", "address_en", "address_hant", "phone", "gihs")
    readonly_fields = ("source_key", "updated_at")
    inlines = [VenueRoomInline, EquipmentInline, TimetableMetaInline]


@admin.register(VenueRoom)
class VenueRoomAdmin(admin.ModelAdmin):
    list_display = ("venue", "room_no", "size_sqm", "size_text_en", "size_text_hant")
    list_filter = ("room_no",)
    search_fields = ("venue__name_en", "venue__name_hant")
    autocomplete_fields = ("venue",)


@admin.register(Equipment)
class EquipmentAdmin(admin.ModelAdmin):
    list_display = ("name_en", "name_hant", "name_hans", "quantity", "room_no", "shared_use", "venue")
    list_filter = ("shared_use", "room_no")
    search_fields = ("name_en", "name_hant", "name_hans", "venue__name_en", "venue__name_hant")
    autocomplete_fields = ("venue",)


@admin.register(TimetableMeta)
class TimetableMetaAdmin(admin.ModelAdmin):
    list_display = (
        "venue",
        "room_no",
        "year",
        "month",
        "hourly_quota",
        "monthly_quota",
        "issued_on",
        "error",
    )
    list_filter = ("year", "month", "error")
    search_fields = ("venue__name_en", "venue__name_hant", "source_url")
    autocomplete_fields = ("venue",)


@admin.register(OpeningSlot)
class OpeningSlotAdmin(admin.ModelAdmin):
    list_display = ("venue", "room_no", "slot_date", "start_time", "end_time", "status")
    list_filter = ("status", "room_no")
    date_hierarchy = "slot_date"
    search_fields = ("venue__name_en", "venue__name_hant")
    autocomplete_fields = ("venue",)
    ordering = ("-slot_date", "start_time")
    list_per_page = 50


@admin.register(SyncRun)
class SyncRunAdmin(admin.ModelAdmin):
    list_display = ("id", "status", "trigger", "created_at", "started_at", "finished_at", "count_summary")
    list_filter = ("status", "trigger")
    ordering = ("-created_at",)

    def count_summary(self, obj):
        if not obj.counts:
            return ""
        return ", ".join(f"{key}={value}" for key, value in obj.counts.items())

    count_summary.short_description = "Counts"

    def has_add_permission(self, request):
        return False

    def get_readonly_fields(self, request, obj=None):
        return [field.name for field in self.model._meta.fields]
