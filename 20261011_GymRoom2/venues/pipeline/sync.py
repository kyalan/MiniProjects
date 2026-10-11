import hashlib
import logging
import re
import time
from datetime import date

from django.contrib.gis.geos import Point
from django.db import connection, transaction
from django.db.models import Q
from django.utils import timezone

from venues.models import Equipment, OpeningSlot, SyncRun, TimetableMeta, Venue, VenueRoom

from .coords import locate, manual_location, parse_sizes
from .http import fetch_bytes, fetch_json, fetch_text, make_session
from .listing import html_text, norm_key, parse_listing, parse_room_page
from .names import HansConverter
from .timetable import parse_pdf, parse_xlsx

logger = logging.getLogger(__name__)

LOC_URL = "https://www.lcsd.gov.hk/datagovhk/facility/facility-fitrm.json"
EQ_URL = "https://www.lcsd.gov.hk/datagovhk/facility/facility-fiteqmt.json"
LIST_EN = "https://www.lcsd.gov.hk/clpss/en/webApp/FitnessRooms.do"
LIST_TC = "https://www.lcsd.gov.hk/clpss/tc/webApp/FitnessRooms.do"
DETAIL_EN = "https://www.lcsd.gov.hk/clpss/en/webApp/FitnessRoomDetails.do?id={detail_id}"
DETAIL_TC = "https://www.lcsd.gov.hk/clpss/tc/webApp/FitnessRoomDetails.do?id={detail_id}"
FILE_BASE = "https://www.lcsd.gov.hk/file_upload_clpss/leisure_facilities/fitness/common/download"
LOCK_KEY = 58204611
COOLDOWN_MINUTES = 10
STALE_MINUTES = 45


def clean(value) -> str:
    return html_text(value)


def parse_count(value, default=1) -> int:
    match = re.search(r"\d+", str(value or ""))
    return int(match.group(0)) if match else default


def append_log(run: SyncRun, message: str) -> None:
    stamp = timezone.localtime().strftime("%H:%M:%S")
    line = f"{stamp} {message}"
    run.log = f"{run.log}\n{line}".strip() if run.log else line
    SyncRun.objects.filter(pk=run.pk).update(log=run.log)


def file_url(detail_id: int, year: int, month: int, ext: str) -> str:
    return f"{FILE_BASE}/{detail_id}_{year}{month:02d}.{ext}"


def target_months(today: date | None = None) -> list[tuple[int, int]]:
    current = today or timezone.localdate()
    months = [(current.year, current.month)]
    if current.month == 12:
        months.append((current.year + 1, 1))
    else:
        months.append((current.year, current.month + 1))
    return months


def enqueue_sync(trigger: str, bypass_cooldown: bool = False):
    from datetime import timedelta

    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_xact_lock(%s)", [LOCK_KEY])
        active = (
            SyncRun.objects.filter(status__in=[SyncRun.Status.QUEUED, SyncRun.Status.RUNNING])
            .order_by("created_at")
            .first()
        )
        if active is not None:
            return active, False, None
        if not bypass_cooldown:
            latest = (
                SyncRun.objects.filter(status__in=[SyncRun.Status.SUCCESS, SyncRun.Status.FAILED])
                .order_by("-finished_at")
                .first()
            )
            anchor = None if latest is None else (latest.finished_at or latest.created_at)
            if anchor and timezone.now() - anchor < timedelta(minutes=COOLDOWN_MINUTES):
                return latest, False, anchor + timedelta(minutes=COOLDOWN_MINUTES)
        run = SyncRun.objects.create(
            status=SyncRun.Status.RUNNING if trigger == SyncRun.Trigger.CLI else SyncRun.Status.QUEUED,
            trigger=trigger,
            started_at=timezone.now() if trigger == SyncRun.Trigger.CLI else None,
        )
        return run, True, None


def recover_stale() -> None:
    from datetime import timedelta

    cutoff = timezone.now() - timedelta(minutes=STALE_MINUTES)
    SyncRun.objects.filter(status=SyncRun.Status.RUNNING).filter(
        Q(started_at__lt=cutoff) | Q(started_at__isnull=True)
    ).update(status=SyncRun.Status.FAILED, finished_at=timezone.now())


def claim_queued() -> SyncRun | None:
    recover_stale()
    with transaction.atomic():
        run = (
            SyncRun.objects.select_for_update(skip_locked=True)
            .filter(status=SyncRun.Status.QUEUED)
            .order_by("created_at")
            .first()
        )
        if run is None:
            return None
        run.status = SyncRun.Status.RUNNING
        run.started_at = timezone.now()
        run.save(update_fields=["status", "started_at"])
        return run


def execute_sync(run: SyncRun) -> None:
    if run.status == SyncRun.Status.QUEUED:
        run.status = SyncRun.Status.RUNNING
        run.started_at = timezone.now()
        run.save(update_fields=["status", "started_at"])
    try:
        run.counts = perform(run)
        run.status = SyncRun.Status.SUCCESS
    except Exception as exc:
        logger.exception("Fitness room sync failed")
        run.status = SyncRun.Status.FAILED
        append_log(run, f"ERROR: {exc}")
    run.finished_at = timezone.now()
    run.save(update_fields=["status", "counts", "finished_at", "log"])


def perform(run: SyncRun) -> dict:
    counts = {
        "venues": 0,
        "rooms": 0,
        "equipment": 0,
        "removed_venues": 0,
        "slots": 0,
        "timetables": 0,
        "timetable_errors": 0,
        "not_published": 0,
        "unmatched_venues": 0,
        "duplicate_rows": 0,
    }
    session = make_session()
    converter = HansConverter()
    append_log(run, "Downloading location and equipment JSON")
    locations = fetch_json(session, LOC_URL)
    equipment_rows = fetch_json(session, EQ_URL)
    if not isinstance(locations, list) or len(locations) < 10:
        raise RuntimeError("Location feed was empty or incomplete")
    if not isinstance(equipment_rows, list) or len(equipment_rows) < 10:
        raise RuntimeError("Equipment feed was empty or incomplete")
    append_log(run, "Downloading LCSD listing pages")
    english_rows = parse_listing(fetch_text(session, LIST_EN))
    chinese_rows = parse_listing(fetch_text(session, LIST_TC))
    if len(english_rows) < 10:
        raise RuntimeError("English listing page did not contain fitness rooms")
    with transaction.atomic():
        venues, listing_only = _upsert_venues(locations, english_rows, chinese_rows, converter, run, counts)
        _replace_equipment(venues, equipment_rows, converter, counts)
    _fill_listing_only(session, listing_only, converter, run, counts)
    append_log(run, f"Stored {counts['venues']} venues and {counts['equipment']} equipment rows")
    months = target_months()
    for venue in venues:
        if not venue.lcsd_detail_id:
            counts["unmatched_venues"] += 1
            append_log(run, f"No LCSD detail id for {venue.name_en}")
            continue
        for year, month in months:
            time.sleep(0.3)
            try:
                outcome, slot_count = _refresh_timetable(session, venue, year, month)
            except Exception as exc:
                counts["timetable_errors"] += 1
                append_log(run, f"Timetable failed {venue.lcsd_detail_id} {year}-{month:02d}: {exc}")
                continue
            if outcome == "not_published":
                counts["not_published"] += 1
                append_log(run, f"No file {venue.lcsd_detail_id} {year}-{month:02d}")
            elif outcome == "unchanged":
                append_log(run, f"Unchanged {venue.lcsd_detail_id} {year}-{month:02d}")
            elif outcome == "parse_failed":
                counts["timetable_errors"] += 1
                append_log(run, f"Could not read {venue.lcsd_detail_id} {year}-{month:02d}")
            else:
                counts["timetables"] += 1
                counts["slots"] += slot_count
                append_log(run, f"Saved {slot_count} slots for {venue.name_en} {year}-{month:02d}")
    append_log(run, "Sync finished")
    return counts


# Place names that appear in LCSD addresses, mapped to the district stored for other rooms.
_DISTRICT_HINTS = (
    ("wong tai sin", "黃大仙", "Wong Tai Sin", "黃大仙區"),
    ("kwun tong", "觀塘", "Kwun Tong", "觀塘區"),
    ("sham shui po", "深水埗", "Sham Shui Po", "深水埗區"),
    ("yau tsim mong", "油尖旺", "Yau Tsim Mong", "油尖旺區"),
    ("kowloon city", "九龍城", "Kowloon City", "九龍城區"),
    ("wan chai", "灣仔", "Wan Chai", "灣仔區"),
    ("central", "中西", "Central & Western", "中西區"),
    ("eastern", "東區", "Eastern", "東區"),
    ("southern", "南區", "Southern", "南區"),
    ("islands", "離島", "Islands", "離島區"),
    ("kwai tsing", "葵青", "Kwai Tsing", "葵青區"),
    ("tsuen wan", "荃灣", "Tsuen Wan", "荃灣區"),
    ("tuen mun", "屯門", "Tuen Mun", "屯門區"),
    ("yuen long", "元朗", "Yuen Long", "元朗區"),
    ("north", "北區", "North", "北區"),
    ("tai po", "大埔", "Tai Po", "大埔區"),
    ("sha tin", "沙田", "Sha Tin", "沙田區"),
    ("sai kung", "西貢", "Sai Kung", "西貢區"),
)


def _district_hint(address_en: str, address_hant: str) -> tuple[str, str]:
    english = (address_en or "").casefold()
    chinese = address_hant or ""
    for english_bit, chinese_bit, english_name, chinese_name in _DISTRICT_HINTS:
        if chinese_bit and chinese_bit in chinese:
            return english_name, chinese_name
        if english_bit and len(english_bit) >= 8 and english_bit in english:
            return english_name, chinese_name
    return "", ""


def _upsert_venues(locations, english_rows, chinese_rows, converter, run, counts) -> tuple[list[Venue], list[Venue]]:
    en_by_name = {norm_key(row["name"]): row for row in english_rows}
    zh_by_name = {norm_key(row["name"]): row for row in chinese_rows}
    zh_by_id = {row["detail_id"]: row for row in chinese_rows}
    seen: dict[str, dict] = {}
    for row in locations:
        name_en = clean(row.get("Name_en"))
        name_hant = clean(row.get("Name_cn"))
        key = norm_key(name_en) or norm_key(name_hant)
        if not key:
            continue
        if key in seen:
            counts["duplicate_rows"] += 1
            append_log(run, f"Duplicate row ignored for {name_en or name_hant}")
            continue
        seen[key] = row
    listing_only_keys: set[str] = set()
    for row in english_rows:
        key = norm_key(row["name"])
        if not key or key in seen:
            continue
        chinese = zh_by_id.get(row["detail_id"], {})
        district_en, district_hant = _district_hint(row.get("address") or "", chinese.get("address") or "")
        seen[key] = {
            "Name_en": row["name"],
            "Name_cn": chinese.get("name") or "",
            "Address_en": row.get("address") or "",
            "Address_cn": chinese.get("address") or "",
            "Phone": row.get("phone") or chinese.get("phone") or "",
            "District_en": district_en,
            "District_cn": district_hant,
            "Latitude": "",
            "Longitude": "",
            "Size_en": "",
            "Size_cn": "",
            "GIHS": "",
        }
        listing_only_keys.add(key)
        append_log(run, f"Listing room is not in the facility file: {row['name']} ({row['detail_id']})")
    keys = list(seen)
    stale = Venue.objects.exclude(source_key__in=keys)
    counts["removed_venues"] = stale.count()
    stale.delete()
    Venue.objects.update(lcsd_detail_id=None)
    used_ids: set[int] = set()
    venues: list[Venue] = []
    for key, row in seen.items():
        name_en = clean(row.get("Name_en"))
        name_hant = clean(row.get("Name_cn"))
        match = en_by_name.get(norm_key(name_en)) or zh_by_name.get(norm_key(name_hant))
        detail_id = match["detail_id"] if match else None
        if detail_id in used_ids:
            append_log(run, f"Detail id {detail_id} already used; left blank for {name_en}")
            detail_id = None
        if detail_id:
            used_ids.add(detail_id)
        lat, lng, quality = locate(row.get("Latitude"), row.get("Longitude"))
        manual = manual_location(name_en)
        if manual is not None:
            lat, lng = manual
            quality = "ok"
            append_log(run, f"Using Google Maps coordinate for {name_en}")
        size_en = clean(row.get("Size_en"))
        size_hant = clean(row.get("Size_cn"))
        venue, _created = Venue.objects.update_or_create(
            source_key=key,
            defaults={
                "lcsd_detail_id": detail_id,
                "gihs": clean(row.get("GIHS"))[:32],
                "name_en": name_en,
                "name_hant": name_hant,
                "name_hans": converter.convert(name_hant),
                "address_en": clean(row.get("Address_en")),
                "address_hant": clean(row.get("Address_cn")),
                "address_hans": converter.convert(clean(row.get("Address_cn"))),
                "district_en": clean(row.get("District_en")),
                "district_hant": clean(row.get("District_cn")),
                "district_hans": converter.convert(clean(row.get("District_cn"))),
                "region": match.get("region", "") if match else "",
                "phone": clean(row.get("Phone")),
                "size_text_en": size_en,
                "size_text_hant": size_hant,
                "size_text_hans": converter.convert(size_hant),
                "location": Point(lng, lat, srid=4326) if quality == "ok" and lat is not None and lng is not None else None,
                "location_quality": quality,
                "accessible_equipment": bool(match and match.get("accessible")),
            },
        )
        _replace_rooms(venue, size_en, size_hant, converter)
        counts["venues"] += 1
        counts["rooms"] += venue.rooms.count()
        venues.append(venue)
    listing_only = [venue for venue in venues if venue.source_key in listing_only_keys]
    return venues, listing_only


def _fill_listing_only(session, venues: list[Venue], converter, run, counts) -> None:
    for venue in venues:
        if not venue.lcsd_detail_id:
            continue
        time.sleep(0.3)
        english = parse_room_page(fetch_text(session, DETAIL_EN.format(detail_id=venue.lcsd_detail_id)) or "")
        time.sleep(0.3)
        chinese = parse_room_page(fetch_text(session, DETAIL_TC.format(detail_id=venue.lcsd_detail_id)) or "")
        size_en = english["size"]
        size_hant = chinese["size"]
        if size_en or size_hant:
            venue.size_text_en = size_en
            venue.size_text_hant = size_hant
            venue.size_text_hans = converter.convert(size_hant) if size_hant else ""
            venue.save(update_fields=["size_text_en", "size_text_hant", "size_text_hans"])
            _replace_rooms(venue, size_en, size_hant, converter)
        chinese_items = chinese["equipment"]
        venue.equipment.all().delete()
        pending = []
        for index, item in enumerate(english["equipment"]):
            name_hant = chinese_items[index]["name"] if index < len(chinese_items) else ""
            pending.append(
                Equipment(
                    venue=venue,
                    room_no=1,
                    name_en=item["name"],
                    name_hant=name_hant,
                    name_hans=converter.convert(name_hant) if name_hant else "",
                    quantity=item["quantity"],
                    shared_use=False,
                )
            )
        Equipment.objects.bulk_create(pending, batch_size=100)
        counts["equipment"] += len(pending)
        append_log(
            run,
            f"Read {len(pending)} equipment rows from the details page for {venue.name_en}",
        )


def _replace_rooms(venue: Venue, size_en: str, size_hant: str, converter) -> None:
    venue.rooms.all().delete()
    sizes = parse_sizes(size_en)
    if not sizes:
        VenueRoom.objects.create(
            venue=venue,
            room_no=1,
            size_text_en=size_en,
            size_text_hant=size_hant,
            size_text_hans=converter.convert(size_hant),
        )
        return
    for index, sqm in enumerate(sizes, start=1):
        label_en = f"{sqm:g} m²"
        label_hant = f"{sqm:g}平方米"
        VenueRoom.objects.create(
            venue=venue,
            room_no=index,
            size_sqm=sqm,
            size_text_en=label_en,
            size_text_hant=label_hant,
            size_text_hans=converter.convert(label_hant),
        )


def _replace_equipment(venues, equipment_rows, converter, counts) -> None:
    by_en: dict[str, list] = {}
    by_zh: dict[str, list] = {}
    for row in equipment_rows:
        name_en = clean(row.get("Equipment_en")) or clean(row.get("Equipment_cn"))
        if not name_en:
            continue
        name_hant = clean(row.get("Equipment_cn"))
        item = {
            "room_no": parse_count(row.get("Room_No"), 1),
            "name_en": name_en,
            "name_hant": name_hant,
            "name_hans": converter.convert(name_hant),
            "quantity": parse_count(row.get("No_of_set"), 1),
            "shared_use": str(row.get("Shared_with_persons_with_disabilities") or "").strip().upper() == "Y",
        }
        english_key = norm_key(row.get("Name_en"))
        chinese_key = norm_key(row.get("Name_cn"))
        if english_key:
            by_en.setdefault(english_key, []).append(item)
            if chinese_key:
                by_zh[chinese_key] = by_en[english_key]
        elif chinese_key:
            by_zh.setdefault(chinese_key, []).append(item)
    venue_ids = [venue.pk for venue in venues]
    Equipment.objects.filter(venue_id__in=venue_ids).delete()
    pending: list[Equipment] = []
    for venue in venues:
        items = by_en.get(norm_key(venue.name_en)) or by_zh.get(norm_key(venue.name_hant)) or []
        merged: dict[tuple[int, str], dict] = {}
        for item in items:
            key = (item["room_no"], item["name_en"])
            if key in merged:
                merged[key]["quantity"] += item["quantity"]
                merged[key]["shared_use"] = merged[key]["shared_use"] or item["shared_use"]
            else:
                merged[key] = dict(item)
        if any(item["shared_use"] for item in merged.values()) and not venue.accessible_equipment:
            venue.accessible_equipment = True
            venue.save(update_fields=["accessible_equipment"])
        for item in merged.values():
            pending.append(Equipment(venue=venue, **item))
    Equipment.objects.bulk_create(pending, batch_size=500)
    counts["equipment"] = len(pending)


def _refresh_timetable(session, venue: Venue, year: int, month: int) -> tuple[str, int]:
    xlsx_url = file_url(venue.lcsd_detail_id, year, month, "xlsx")
    content = fetch_bytes(session, xlsx_url)
    source_url = xlsx_url
    parser = parse_xlsx
    if content is None:
        pdf_url = file_url(venue.lcsd_detail_id, year, month, "pdf")
        content = fetch_bytes(session, pdf_url)
        source_url = pdf_url
        parser = parse_pdf
    if content is None:
        _mark_missing(venue, year, month, "not_published", xlsx_url)
        return "not_published", 0
    digest = hashlib.sha256(content).hexdigest()
    unchanged = TimetableMeta.objects.filter(
        venue=venue,
        year=year,
        month=month,
        file_sha256=digest,
        error="",
    ).exists()
    if unchanged:
        return "unchanged", 0
    parsed_rooms = parser(content, year, month)
    if not parsed_rooms:
        _mark_missing(venue, year, month, "parse_failed", source_url)
        return "parse_failed", 0
    total = 0
    for parsed in parsed_rooms:
        total += _store_grid(venue, parsed, year, month, source_url, digest)
    return "saved", total


def _mark_missing(venue: Venue, year: int, month: int, code: str, url: str) -> None:
    has_slots = OpeningSlot.objects.filter(
        venue=venue,
        room_no=1,
        slot_date__year=year,
        slot_date__month=month,
    ).exists()
    if has_slots:
        return
    TimetableMeta.objects.update_or_create(
        venue=venue,
        room_no=1,
        year=year,
        month=month,
        defaults={"error": code, "source_url": url, "file_sha256": ""},
    )


def _store_grid(venue, parsed, year, month, source_url, digest) -> int:
    room_no = parsed["room_no"]
    with transaction.atomic():
        OpeningSlot.objects.filter(
            venue=venue,
            room_no=room_no,
            slot_date__year=year,
            slot_date__month=month,
        ).delete()
        deduped = {}
        for slot in parsed["slots"]:
            deduped[(slot["date"], slot["start"])] = slot
        OpeningSlot.objects.bulk_create(
            [
                OpeningSlot(
                    venue=venue,
                    room_no=room_no,
                    slot_date=slot["date"],
                    start_time=slot["start"],
                    end_time=slot["end"],
                    status=slot["status"],
                )
                for slot in deduped.values()
            ],
            batch_size=1000,
        )
        stored = len(deduped)
        TimetableMeta.objects.update_or_create(
            venue=venue,
            room_no=room_no,
            year=year,
            month=month,
            defaults={
                "hourly_quota": parsed["hourly_quota"],
                "monthly_quota": parsed["monthly_quota"],
                "issued_on": parsed["issued_on"],
                "source_updated_on": parsed["source_updated_on"],
                "source_url": source_url,
                "file_sha256": digest,
                "error": "",
            },
        )
    return stored
