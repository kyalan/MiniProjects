import re

HK_LAT = (22.13, 22.58)
HK_LNG = (113.80, 114.50)


def dms_to_decimal(value: str | None) -> float | None:
    text = (value or "").strip()
    if not text:
        return None
    parts = text.split("-")
    if len(parts) != 3:
        return None
    try:
        degrees, minutes, seconds = (int(part) for part in parts)
    except ValueError:
        return None
    if seconds == 60:
        seconds = 0
        minutes += 1
    if minutes == 60:
        minutes = 0
        degrees += 1
    if minutes < 0 or minutes >= 60 or seconds < 0 or seconds >= 60 or degrees < 0:
        return None
    return degrees + minutes / 60 + seconds / 3600


# Google Maps corrections. The LCSD file publishes 00-00-00 for Hiu Kwong Street,
# an impossible longitude for Sham Shui Po, usable but wrong points for
# Tung Cheong Street and Choi Wing Road, and no coordinate for Ma Chai Hang.
MANUAL_LOCATIONS = {
    "hiu kwong street sports centre": (22.3197111, 114.2251903),
    "sham shui po sports centre": (22.3308265, 114.146248),
    "tung cheong street sports centre": (22.4496581, 114.1678594),
    "choi wing road sports centre": (22.3294345, 114.213932),
    "ma chai hang sports centre": (22.3445776, 114.1867359),
}


def manual_location(name: str | None) -> tuple[float, float] | None:
    key = re.sub(r"\s+", " ", (name or "").replace("\u3000", " ")).strip().casefold()
    point = MANUAL_LOCATIONS.get(key)
    if point is None:
        return None
    lat, lng = point
    if not (HK_LAT[0] <= lat <= HK_LAT[1] and HK_LNG[0] <= lng <= HK_LNG[1]):
        return None
    return lat, lng


def locate(lat_raw: str | None, lng_raw: str | None) -> tuple[float | None, float | None, str]:
    lat_text = (lat_raw or "").strip()
    lng_text = (lng_raw or "").strip()
    if not lat_text and not lng_text:
        return None, None, "missing"
    lat = dms_to_decimal(lat_text)
    lng = dms_to_decimal(lng_text)
    if lat is None or lng is None:
        return None, None, "invalid"
    if lat == 0 and lng == 0:
        return None, None, "missing"
    if not (HK_LAT[0] <= lat <= HK_LAT[1] and HK_LNG[0] <= lng <= HK_LNG[1]):
        return None, None, "invalid"
    return lat, lng, "ok"


_SIZE_RE = re.compile(r"(\d+(?:\.\d+)?)\s*m", re.IGNORECASE)


def parse_sizes(size_en: str | None) -> list[float]:
    return [float(match) for match in _SIZE_RE.findall(size_en or "")]
