import re
from datetime import date, datetime, timedelta

from django.utils import timezone
from django.utils.translation import get_language

from .equipment import equipment_category, equipment_icon
from .models import OpeningSlot, Venue
from .pipeline.listing import html_text

REGION_LABELS = {
    "hk_island": "Hong Kong Island",
    "kowloon": "Kowloon",
    "nt": "New Territories",
}


def content_language() -> str:
    lang = (get_language() or "zh-hant").lower().replace("_", "-")
    if lang.startswith("en"):
        return "en"
    if "hans" in lang or lang.endswith("-cn"):
        return "hans"
    return "hant"


def pick(obj, field: str) -> str:
    code = content_language()
    primary = getattr(obj, f"{field}_{code}", "") or ""
    if primary:
        return primary
    if code == "en":
        return getattr(obj, f"{field}_hant", "") or ""
    return getattr(obj, f"{field}_hant", "") or getattr(obj, f"{field}_en", "") or ""


def pretty_area(text: str) -> str:
    raw = html_text(text)
    if not raw:
        return ""
    if content_language() == "en":
        return re.sub(r"(\d+(?:\.\d+)?)\s*m\s*2", r"\1 m²", raw, flags=re.IGNORECASE)
    return re.sub(r"[ \t]+", " ", raw)


def official_url(detail_id: int | None) -> str:
    if not detail_id:
        return ""
    code = content_language()
    folder = {"en": "en", "hans": "sc"}.get(code, "tc")
    return f"https://www.lcsd.gov.hk/clpss/{folder}/webApp/FitnessRoomDetails.do?id={detail_id}"


def classify_window(intervals, start: datetime, end: datetime) -> str:
    """Return open, soon, or other for slots that overlap [start, end)."""
    if not intervals:
        return "other"
    if any(status != "A" for _slot_start, _slot_end, status in intervals):
        return "soon"
    cursor = start
    for slot_start, slot_end, _status in sorted(intervals, key=lambda item: item[0]):
        if slot_end <= cursor:
            continue
        if slot_start > cursor:
            return "soon"
        cursor = slot_end
        if cursor >= end:
            return "open"
    return "open" if cursor >= end else "soon"


def horizon_map(venue_id: int | None = None) -> dict[int, str]:
    now = timezone.localtime()
    window_end = now + timedelta(hours=2)
    slots = OpeningSlot.objects.filter(slot_date__in={now.date(), window_end.date()})
    if venue_id is not None:
        slots = slots.filter(venue_id=venue_id)
    grouped: dict[int, list] = {}
    tz = now.tzinfo
    for item_venue_id, slot_date, start_time, end_time, status in slots.values_list(
        "venue_id", "slot_date", "start_time", "end_time", "status"
    ):
        slot_start = datetime.combine(slot_date, start_time, tzinfo=tz)
        slot_end = datetime.combine(slot_date, end_time, tzinfo=tz)
        if slot_end <= slot_start:
            slot_end += timedelta(days=1)
        if slot_end <= now or slot_start >= window_end:
            continue
        grouped.setdefault(item_venue_id, []).append((slot_start, slot_end, status))
    return {item_id: classify_window(intervals, now, window_end) for item_id, intervals in grouped.items()}


def venue_area_sqm(venue: Venue) -> float | None:
    values = [room.size_sqm for room in venue.rooms.all() if room.size_sqm is not None]
    if not values:
        return None
    return float(sum(values))


def current_slot_map(venue_id: int | None = None) -> dict[int, list[str]]:
    now = timezone.localtime()
    slots = OpeningSlot.objects.filter(
        slot_date=now.date(),
        start_time__lte=now.time(),
        end_time__gt=now.time(),
    )
    if venue_id is not None:
        slots = slots.filter(venue_id=venue_id)
    slots = slots.values_list("venue_id", "status")
    grouped: dict[int, list[str]] = {}
    for venue_id, status in slots:
        grouped.setdefault(venue_id, []).append(status)
    return grouped


def venue_card(venue: Venue, equipment_count: int, statuses: list[str], horizon: str = "other") -> dict:
    open_now = "A" in statuses
    current = "A" if open_now else (statuses[0] if statuses else None)
    lat = lng = None
    if venue.location is not None:
        lat = venue.location.y
        lng = venue.location.x
    return {
        "id": venue.pk,
        "name": pick(venue, "name"),
        "address": pick(venue, "address"),
        "district": pick(venue, "district"),
        "region": venue.region,
        "phone": venue.phone,
        "area": pretty_area(pick(venue, "size_text")),
        "area_sqm": venue_area_sqm(venue),
        "horizon": horizon if horizon in {"open", "soon", "other"} else "other",
        "accessible": venue.accessible_equipment,
        "lat": lat,
        "lng": lng,
        "location_quality": venue.location_quality,
        "equipment_count": equipment_count,
        "category_sets": category_quantities(venue),
        "open_now": open_now,
        "current_status": current,
        "official_url": official_url(venue.lcsd_detail_id),
    }


def category_quantities(venue: Venue) -> dict[str, int]:
    totals: dict[str, int] = {}
    for item in venue.equipment.all():
        key = equipment_category(item.name_en)
        totals[key] = totals.get(key, 0) + int(item.quantity or 0)
    return {key: count for key, count in totals.items() if count}


def choose_period(venue: Venue, year: int | None, month: int | None, room_no: int) -> tuple[int, int]:
    metas = list(venue.timetables.filter(room_no=room_no).order_by("-year", "-month"))
    if year and month and any(item.year == year and item.month == month for item in metas):
        return year, month
    today = timezone.localdate()
    for item in metas:
        if item.year == today.year and item.month == today.month and not item.error:
            return item.year, item.month
    for item in metas:
        if not item.error:
            return item.year, item.month
    if metas:
        return metas[0].year, metas[0].month
    return today.year, today.month


def timetable_payload(venue: Venue, year: int, month: int, room_no: int) -> dict | None:
    meta = venue.timetables.filter(year=year, month=month, room_no=room_no).first()
    slots = list(
        venue.slots.filter(room_no=room_no, slot_date__year=year, slot_date__month=month).order_by(
            "start_time", "slot_date"
        )
    )
    if meta is None and not slots:
        return None
    dates = sorted({slot.slot_date for slot in slots})
    grouped: dict[tuple, dict[date, str]] = {}
    for slot in slots:
        key = (slot.start_time, slot.end_time)
        grouped.setdefault(key, {})[slot.slot_date] = slot.status
    rows = []
    for (start, end), cells in grouped.items():
        rows.append(
            {
                "start": start.strftime("%H:%M"),
                "end": end.strftime("%H:%M"),
                "cells": [cells.get(day, "") for day in dates],
            }
        )
    return {
        "year": year,
        "month": month,
        "room_no": room_no,
        "hourly_quota": meta.hourly_quota if meta else None,
        "monthly_quota": meta.monthly_quota if meta else None,
        "issued_on": meta.issued_on.isoformat() if meta and meta.issued_on else None,
        "source_updated_on": meta.source_updated_on.isoformat() if meta and meta.source_updated_on else None,
        "source_url": meta.source_url if meta else "",
        "error": meta.error if meta else "",
        "dates": [day.isoformat() for day in dates],
        "rows": rows,
    }


def venue_detail(venue: Venue, year: int | None, month: int | None, room_no: int) -> dict:
    card = venue_card(
        venue,
        venue.equipment.count(),
        current_slot_map(venue.pk).get(venue.pk, []),
        horizon_map(venue.pk).get(venue.pk, "other"),
    )
    rooms = [
        {
            "room_no": room.room_no,
            "area": pretty_area(pick(room, "size_text")) or (f"{room.size_sqm:g}" if room.size_sqm is not None else ""),
            "size_sqm": float(room.size_sqm) if room.size_sqm is not None else None,
        }
        for room in venue.rooms.all()
    ]
    equipment = [
        {
            "room_no": item.room_no,
            "name": pick(item, "name"),
            "category": equipment_category(item.name_en),
            "icon": equipment_icon(item.name_en),
            "quantity": item.quantity,
            "shared_use": item.shared_use,
        }
        for item in venue.equipment.all()
    ]
    room_numbers = sorted(
        {
            *(room.room_no for room in venue.rooms.all()),
            *(item.room_no for item in venue.equipment.all()),
            *venue.timetables.values_list("room_no", flat=True),
        }
    ) or [1]
    if room_no not in room_numbers:
        room_no = room_numbers[0]
    chosen_year, chosen_month = choose_period(venue, year, month, room_no)
    months = [
        {"year": item.year, "month": item.month, "room_no": item.room_no}
        for item in venue.timetables.order_by("year", "month", "room_no")
    ]
    card.update(
        {
            "rooms": rooms,
            "equipment": equipment,
            "room_numbers": room_numbers,
            "months": months,
            "timetable": timetable_payload(venue, chosen_year, chosen_month, room_no),
        }
    )
    return card


def sync_payload(run) -> dict:
    if run is None:
        return {"run": None}
    log = run.log or ""
    return {
        "run": {
            "id": run.pk,
            "status": run.status,
            "trigger": run.trigger,
            "created_at": run.created_at.isoformat() if run.created_at else None,
            "started_at": run.started_at.isoformat() if run.started_at else None,
            "finished_at": run.finished_at.isoformat() if run.finished_at else None,
            "log_tail": log[-1500:],
            "counts": run.counts or {},
        }
    }
