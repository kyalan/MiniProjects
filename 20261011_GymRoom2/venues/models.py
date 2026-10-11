from django.db import models
from django.contrib.gis.db import models as gis_models


class Venue(models.Model):
    class LocationQuality(models.TextChoices):
        OK = "ok", "OK"
        MISSING = "missing", "Missing"
        INVALID = "invalid", "Invalid"

    class Region(models.TextChoices):
        HK_ISLAND = "hk_island", "Hong Kong Island"
        KOWLOON = "kowloon", "Kowloon"
        NT = "nt", "New Territories"

    source_key = models.CharField(max_length=255, unique=True)
    lcsd_detail_id = models.PositiveIntegerField(null=True, blank=True, unique=True)
    gihs = models.CharField(max_length=32, blank=True)
    name_en = models.CharField(max_length=255)
    name_hant = models.CharField(max_length=255, blank=True)
    name_hans = models.CharField(max_length=255, blank=True)
    address_en = models.TextField(blank=True)
    address_hant = models.TextField(blank=True)
    address_hans = models.TextField(blank=True)
    district_en = models.CharField(max_length=64, blank=True, db_index=True)
    district_hant = models.CharField(max_length=64, blank=True)
    district_hans = models.CharField(max_length=64, blank=True)
    region = models.CharField(max_length=16, blank=True, choices=Region.choices, db_index=True)
    phone = models.CharField(max_length=64, blank=True)
    size_text_en = models.CharField(max_length=80, blank=True)
    size_text_hant = models.CharField(max_length=80, blank=True)
    size_text_hans = models.CharField(max_length=80, blank=True)
    location = gis_models.PointField(srid=4326, null=True, blank=True)
    location_quality = models.CharField(
        max_length=16,
        choices=LocationQuality.choices,
        default=LocationQuality.MISSING,
    )
    accessible_equipment = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "fitness_venue"
        ordering = ["name_en"]
        verbose_name = "Venue"
        verbose_name_plural = "Venues"

    def __str__(self):
        return self.name_en or self.name_hant or f"Venue {self.pk}"


class VenueRoom(models.Model):
    venue = models.ForeignKey(Venue, related_name="rooms", on_delete=models.CASCADE)
    room_no = models.PositiveSmallIntegerField(default=1)
    size_sqm = models.DecimalField(max_digits=8, decimal_places=1, null=True, blank=True)
    size_text_en = models.CharField(max_length=32, blank=True)
    size_text_hant = models.CharField(max_length=32, blank=True)
    size_text_hans = models.CharField(max_length=32, blank=True)

    class Meta:
        db_table = "fitness_venue_room"
        constraints = [
            models.UniqueConstraint(fields=["venue", "room_no"], name="uniq_venue_room"),
        ]
        ordering = ["venue", "room_no"]
        verbose_name = "Venue room"
        verbose_name_plural = "Venue rooms"

    def __str__(self):
        return f"{self.venue} room {self.room_no}"


class Equipment(models.Model):
    venue = models.ForeignKey(Venue, related_name="equipment", on_delete=models.CASCADE)
    room_no = models.PositiveSmallIntegerField(default=1)
    name_en = models.CharField(max_length=255)
    name_hant = models.CharField(max_length=255, blank=True)
    name_hans = models.CharField(max_length=255, blank=True)
    quantity = models.PositiveIntegerField(default=1)
    shared_use = models.BooleanField(default=False)

    class Meta:
        db_table = "fitness_equipment"
        constraints = [
            models.UniqueConstraint(
                fields=["venue", "room_no", "name_en"],
                name="uniq_equipment",
            ),
        ]
        ordering = ["venue", "room_no", "name_en"]
        verbose_name = "Equipment"
        verbose_name_plural = "Equipment"

    def __str__(self):
        return f"{self.name_en} x{self.quantity}"


class TimetableMeta(models.Model):
    venue = models.ForeignKey(Venue, related_name="timetables", on_delete=models.CASCADE)
    room_no = models.PositiveSmallIntegerField(default=1)
    year = models.PositiveSmallIntegerField()
    month = models.PositiveSmallIntegerField()
    hourly_quota = models.PositiveIntegerField(null=True, blank=True)
    monthly_quota = models.PositiveIntegerField(null=True, blank=True)
    issued_on = models.DateField(null=True, blank=True)
    source_updated_on = models.DateField(null=True, blank=True)
    source_url = models.URLField(max_length=500, blank=True)
    file_sha256 = models.CharField(max_length=64, blank=True)
    error = models.CharField(max_length=64, blank=True)

    class Meta:
        db_table = "fitness_timetable"
        constraints = [
            models.UniqueConstraint(
                fields=["venue", "room_no", "year", "month"],
                name="uniq_timetable",
            ),
        ]
        ordering = ["-year", "-month", "venue", "room_no"]
        verbose_name = "Timetable file"
        verbose_name_plural = "Timetable files"

    def __str__(self):
        return f"{self.venue} {self.year}-{self.month:02d} room {self.room_no}"


class OpeningSlot(models.Model):
    venue = models.ForeignKey(Venue, related_name="slots", on_delete=models.CASCADE)
    room_no = models.PositiveSmallIntegerField(default=1)
    slot_date = models.DateField(db_index=True)
    start_time = models.TimeField()
    end_time = models.TimeField()
    status = models.CharField(max_length=1)

    class Meta:
        db_table = "fitness_opening_slot"
        constraints = [
            models.UniqueConstraint(
                fields=["venue", "room_no", "slot_date", "start_time"],
                name="uniq_opening_slot",
            ),
        ]
        verbose_name = "Opening slot"
        verbose_name_plural = "Opening slots"

    def __str__(self):
        return f"{self.slot_date} {self.start_time:%H:%M} {self.status}"


class SyncRun(models.Model):
    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        RUNNING = "running", "Running"
        SUCCESS = "success", "Succeeded"
        FAILED = "failed", "Failed"

    class Trigger(models.TextChoices):
        UI = "ui", "Update button"
        CLI = "cli", "Command"

    status = models.CharField(max_length=16, choices=Status.choices, default=Status.QUEUED, db_index=True)
    trigger = models.CharField(max_length=16, choices=Trigger.choices, default=Trigger.UI)
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    log = models.TextField(blank=True)
    counts = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "fitness_sync_run"
        ordering = ["-created_at"]
        verbose_name = "Sync run"
        verbose_name_plural = "Sync runs"

    def __str__(self):
        return f"Sync #{self.pk} {self.status}"
