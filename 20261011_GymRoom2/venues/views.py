from django.db.models import Count
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from django.utils.translation import gettext as _
from django.views.decorators.http import require_GET, require_POST

from .models import SyncRun, Venue
from .pipeline.sync import enqueue_sync
from .present import content_language, current_slot_map, horizon_map, sync_payload, venue_card, venue_detail


def ui_text() -> dict:
    return {
        "area": _("Area"),
        "phone": _("Phone"),
        "equipment": _("Equipment"),
        "sharedUse": _("Shared use"),
        "openingHours": _("Opening hours"),
        "available": _("Available"),
        "programme": _("Programme"),
        "training": _("Training"),
        "blockBooking": _("Block booking"),
        "maintenance": _("Maintenance"),
        "sessionalBreak": _("Sessional break"),
        "hourlyQuota": _("Hourly ticket quota"),
        "monthlyQuota": _("Monthly ticket quota"),
        "officialPage": _("Official page"),
        "close": _("Close"),
        "locationUnavailable": _("Location unavailable"),
        "noMatch": _("No rooms match these filters."),
        "noTimetable": _("No timetable for this month."),
        "timetableNote": _(
            "Timetable is for reference only. Please contact venue staff for the latest booking status."
        ),
        "sets": _("sets"),
        "room": _("Room"),
        "rooms": _("rooms"),
        "couldNotLoadRooms": _("Could not load rooms."),
        "couldNotLoadRoom": _("Could not load this room."),
        "availableNow": _("Available now"),
        "notOpenNow": _("Not open now"),
        "unknownAvailability": _("No opening data"),
        "freeForTwoHours": _("Free for the next 2 hours"),
        "soonBusy": _("Closes or occupied within 2 hours"),
        "nearMe": _("Near me"),
        "locationDenied": _("Could not read your location"),
        "metres": _("m"),
        "kilometres": _("km"),
        "categoryTreadmill": _("Treadmills"),
        "categoryBike": _("Bikes"),
        "categoryElliptical": _("Ellipticals"),
        "categoryRowing": _("Rowing machines"),
        "categoryFreeWeights": _("Free weights"),
        "categoryUpperBody": _("Upper-body machines"),
        "categoryLowerBody": _("Lower-body machines"),
        "categoryCore": _("Core"),
        "categoryCable": _("Cables and multi-stations"),
        "categoryOther": _("Other equipment"),
        "allEquipment": _("All equipment"),
        "lastUpdated": _("Last updated"),
        "notUpdated": _("Not updated yet"),
        "queued": _("Queued"),
        "running": _("Running"),
        "succeeded": _("Succeeded"),
        "failed": _("Failed"),
        "updateRunning": _("Update already running"),
        "wait": _("Please wait before updating again"),
        "issued": _("Issued"),
        "sourceUpdated": _("Source updated"),
        "notPublished": _("Timetable was not published."),
        "parseFailed": _("Timetable could not be read."),
        "downloadFailed": _("Download failed."),
        "empty": _("No fitness rooms stored yet. Press Update data to load them."),
        "details": _("Full timetable"),
        "fitnessEquipment": _("Fitness equipment"),
        "syncLog": _("Sync log"),
        "regionIsland": _("Hong Kong Island"),
        "regionKowloon": _("Kowloon"),
        "regionNt": _("New Territories"),
    }


def _no_store(response):
    response["Cache-Control"] = "no-store"
    response["Vary"] = "Cookie"
    return response


def map_page(request):
    code = content_language()
    field = {"en": "district_en", "hans": "district_hans"}.get(code, "district_hant")
    districts = [
        name
        for name in Venue.objects.exclude(**{field: ""}).order_by(field).values_list(field, flat=True).distinct()
        if name
    ]
    last_success = SyncRun.objects.filter(status=SyncRun.Status.SUCCESS).order_by("-finished_at").first()
    response = render(
        request,
        "venues/map.html",
        {
            "districts": districts,
            "i18n": ui_text(),
            "last_success": timezone.localtime(last_success.finished_at) if last_success and last_success.finished_at else None,
        },
    )
    return _no_store(response)


@require_GET
def venue_list(request):
    statuses = current_slot_map()
    horizons = horizon_map()
    venues = Venue.objects.annotate(equipment_count=Count("equipment")).prefetch_related("rooms", "equipment")
    payload = [
        venue_card(venue, venue.equipment_count, statuses.get(venue.pk, []), horizons.get(venue.pk, "other"))
        for venue in venues
    ]
    return _no_store(JsonResponse({"venues": payload}))


@require_GET
def venue_detail_view(request, pk: int):
    venue = get_object_or_404(
        Venue.objects.prefetch_related("rooms", "equipment", "timetables"),
        pk=pk,
    )
    year = _optional_int(request.GET.get("year"))
    month = _optional_int(request.GET.get("month"))
    room_no = _optional_int(request.GET.get("room")) or 1
    return _no_store(JsonResponse(venue_detail(venue, year, month, room_no)))


@require_POST
def sync_start(request):
    run, created, cooldown_until = enqueue_sync(SyncRun.Trigger.UI)
    payload = sync_payload(run)
    payload["last_success_at"] = _last_success_iso()
    if created:
        payload["message"] = _("Update queued.")
        return _no_store(JsonResponse(payload, status=202))
    if cooldown_until is not None:
        seconds = max(1, int((cooldown_until - timezone.now()).total_seconds()))
        payload["message"] = _("Please wait before updating again")
        payload["retry_after_seconds"] = seconds
        return _no_store(JsonResponse(payload, status=429))
    payload["message"] = _("Update already running")
    return _no_store(JsonResponse(payload, status=200))


@require_GET
def sync_status(request):
    run = SyncRun.objects.order_by("-created_at").first()
    payload = sync_payload(run)
    payload["last_success_at"] = _last_success_iso()
    payload["message"] = ""
    return _no_store(JsonResponse(payload))


def _last_success_iso() -> str | None:
    last = SyncRun.objects.filter(status=SyncRun.Status.SUCCESS).order_by("-finished_at").first()
    if last is None or last.finished_at is None:
        return None
    return timezone.localtime(last.finished_at).isoformat()


def _optional_int(value: str | None) -> int | None:
    if not value:
        return None
    try:
        return int(value)
    except ValueError:
        return None
