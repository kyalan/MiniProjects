import django.contrib.gis.db.models.fields
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Venue",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("source_key", models.CharField(max_length=255, unique=True)),
                ("lcsd_detail_id", models.PositiveIntegerField(blank=True, null=True, unique=True)),
                ("gihs", models.CharField(blank=True, max_length=32)),
                ("name_en", models.CharField(max_length=255)),
                ("name_hant", models.CharField(blank=True, max_length=255)),
                ("name_hans", models.CharField(blank=True, max_length=255)),
                ("address_en", models.TextField(blank=True)),
                ("address_hant", models.TextField(blank=True)),
                ("address_hans", models.TextField(blank=True)),
                ("district_en", models.CharField(blank=True, db_index=True, max_length=64)),
                ("district_hant", models.CharField(blank=True, max_length=64)),
                ("district_hans", models.CharField(blank=True, max_length=64)),
                ("region", models.CharField(blank=True, choices=[("hk_island", "Hong Kong Island"), ("kowloon", "Kowloon"), ("nt", "New Territories")], db_index=True, max_length=16)),
                ("phone", models.CharField(blank=True, max_length=64)),
                ("size_text_en", models.CharField(blank=True, max_length=80)),
                ("size_text_hant", models.CharField(blank=True, max_length=80)),
                ("size_text_hans", models.CharField(blank=True, max_length=80)),
                ("location", django.contrib.gis.db.models.fields.PointField(blank=True, null=True, srid=4326)),
                ("location_quality", models.CharField(choices=[("ok", "OK"), ("missing", "Missing"), ("invalid", "Invalid")], default="missing", max_length=16)),
                ("accessible_equipment", models.BooleanField(default=False)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Venue",
                "verbose_name_plural": "Venues",
                "db_table": "fitness_venue",
                "ordering": ["name_en"],
            },
        ),
        migrations.CreateModel(
            name="SyncRun",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("queued", "Queued"), ("running", "Running"), ("success", "Succeeded"), ("failed", "Failed")], db_index=True, default="queued", max_length=16)),
                ("trigger", models.CharField(choices=[("ui", "Update button"), ("cli", "Command")], default="ui", max_length=16)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("started_at", models.DateTimeField(blank=True, null=True)),
                ("finished_at", models.DateTimeField(blank=True, null=True)),
                ("log", models.TextField(blank=True)),
                ("counts", models.JSONField(blank=True, default=dict)),
            ],
            options={
                "verbose_name": "Sync run",
                "verbose_name_plural": "Sync runs",
                "db_table": "fitness_sync_run",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="VenueRoom",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("room_no", models.PositiveSmallIntegerField(default=1)),
                ("size_sqm", models.DecimalField(blank=True, decimal_places=1, max_digits=8, null=True)),
                ("size_text_en", models.CharField(blank=True, max_length=32)),
                ("size_text_hant", models.CharField(blank=True, max_length=32)),
                ("size_text_hans", models.CharField(blank=True, max_length=32)),
                ("venue", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="rooms", to="venues.venue")),
            ],
            options={
                "verbose_name": "Venue room",
                "verbose_name_plural": "Venue rooms",
                "db_table": "fitness_venue_room",
                "ordering": ["venue", "room_no"],
                "constraints": [models.UniqueConstraint(fields=("venue", "room_no"), name="uniq_venue_room")],
            },
        ),
        migrations.CreateModel(
            name="Equipment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("room_no", models.PositiveSmallIntegerField(default=1)),
                ("name_en", models.CharField(max_length=255)),
                ("name_hant", models.CharField(blank=True, max_length=255)),
                ("name_hans", models.CharField(blank=True, max_length=255)),
                ("quantity", models.PositiveIntegerField(default=1)),
                ("shared_use", models.BooleanField(default=False)),
                ("venue", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="equipment", to="venues.venue")),
            ],
            options={
                "verbose_name": "Equipment",
                "verbose_name_plural": "Equipment",
                "db_table": "fitness_equipment",
                "ordering": ["venue", "room_no", "name_en"],
                "constraints": [models.UniqueConstraint(fields=("venue", "room_no", "name_en"), name="uniq_equipment")],
            },
        ),
        migrations.CreateModel(
            name="TimetableMeta",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("room_no", models.PositiveSmallIntegerField(default=1)),
                ("year", models.PositiveSmallIntegerField()),
                ("month", models.PositiveSmallIntegerField()),
                ("hourly_quota", models.PositiveIntegerField(blank=True, null=True)),
                ("monthly_quota", models.PositiveIntegerField(blank=True, null=True)),
                ("issued_on", models.DateField(blank=True, null=True)),
                ("source_updated_on", models.DateField(blank=True, null=True)),
                ("source_url", models.URLField(blank=True, max_length=500)),
                ("file_sha256", models.CharField(blank=True, max_length=64)),
                ("error", models.CharField(blank=True, max_length=64)),
                ("venue", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="timetables", to="venues.venue")),
            ],
            options={
                "verbose_name": "Timetable file",
                "verbose_name_plural": "Timetable files",
                "db_table": "fitness_timetable",
                "ordering": ["-year", "-month", "venue", "room_no"],
                "constraints": [models.UniqueConstraint(fields=("venue", "room_no", "year", "month"), name="uniq_timetable")],
            },
        ),
        migrations.CreateModel(
            name="OpeningSlot",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("room_no", models.PositiveSmallIntegerField(default=1)),
                ("slot_date", models.DateField(db_index=True)),
                ("start_time", models.TimeField()),
                ("end_time", models.TimeField()),
                ("status", models.CharField(max_length=1)),
                ("venue", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="slots", to="venues.venue")),
            ],
            options={
                "verbose_name": "Opening slot",
                "verbose_name_plural": "Opening slots",
                "db_table": "fitness_opening_slot",
                "constraints": [models.UniqueConstraint(fields=("venue", "room_no", "slot_date", "start_time"), name="uniq_opening_slot")],
            },
        ),
    ]
