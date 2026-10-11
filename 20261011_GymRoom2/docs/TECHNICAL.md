# Technical specification

This site maps Leisure and Cultural Services Department (LCSD) fitness rooms in Hong Kong. The public page is a map and a card list. Django Admin at `/admin/` is the table viewer. A background worker refreshes the government files when someone presses Update data.

## Language and runtime

- Python 3.12
- Django 5, with GeoDjango
- PostgreSQL 16 with PostGIS, spatial reference 4326
- Gunicorn serves the site
- Docker Compose runs three services from one image plus the database image

| Service | Role |
| --- | --- |
| `db` | `postgis/postgis:16-3.4`. Database name, user, and password default to `gymrooms`. |
| `web` | Gunicorn on port 8000. On start it migrates and creates the admin user. |
| `worker` | `python manage.py run_sync_worker`. It claims one queued sync at a time with `SELECT … FOR UPDATE SKIP LOCKED`. |

Time zone is `Asia/Hong_Kong`. The public page defaults to Traditional Chinese. Simplified Chinese and English come from Django’s language cookie. Interface text is gettext. Venue names, addresses, and equipment names are stored in three columns because the government files do not include Simplified Chinese.

## Python packages

| Package | Use |
| --- | --- |
| Django | Site, admin, GeoDjango models, translations |
| `psycopg` | PostgreSQL driver |
| Gunicorn | HTTP server in the web container |
| WhiteNoise | Serves collected static files |
| `requests` | Downloads the LCSD JSON, HTML, and timetable files |
| Beautiful Soup | Reads the fitness-room listing pages |
| openpyxl | Reads the monthly Excel timetables |
| pdfplumber | Fallback when a month has a PDF and no Excel file |
| OpenCC (`opencc-python-reimplemented`) | Converts Traditional Chinese to Simplified Chinese with the `hk2s` config |

## Map

The page keeps Leaflet 1.9 for markers, popups, clustering, and the browser location control. The background is not a raster OpenStreetMap tile. It is OpenFreeMap’s Positron style, loaded through MapLibre GL JS 5.6.1 and `@maplibre/maplibre-gl-leaflet` 0.1.0:

`https://tiles.openfreemap.org/styles/positron`

Positron is a light gray vector style. MapLibre adds the OpenFreeMap and OpenStreetMap attribution. Those libraries are stored under `venues/static/venues/vendor/` and are not loaded from a CDN at runtime.

Each venue is one gym-shaped marker. Colour is the next two hours of timetable data: green when every overlapping slot is available, amber when a slot is programme, training, block booking, maintenance, a sessional break, or the available run ends inside the window, and gray when that window has no timetable. Size follows the square root of the summed room area, from about 28px to 52px. Each visit clears the previous position and asks the browser for a fresh one (`maximumAge: 0`). The card list is then sorted by straight-line distance. “Near me” repeats that request.

## Where the data comes from

The sync does not scrape a private API. It downloads public LCSD files with the user agent `GymRoomMap/1.0 (local mirror of public LCSD fitness-room open data)` and a short pause between file downloads.

1. Locations, district, address, phone, floor area, and degrees-minutes-seconds coordinates: `https://www.lcsd.gov.hk/datagovhk/facility/facility-fitrm.json`
2. Equipment name, quantity, and shared-use flag: `https://www.lcsd.gov.hk/datagovhk/facility/facility-fiteqmt.json`
3. Detail-page id, region, and the disability-equipment mark: `https://www.lcsd.gov.hk/clpss/en/webApp/FitnessRooms.do` and the Traditional Chinese listing at `/clpss/tc/webApp/FitnessRooms.do`
4. Monthly timeslots, named `{detail id}_{YYYYMM}.xlsx`, from `https://www.lcsd.gov.hk/file_upload_clpss/leisure_facilities/fitness/common/download/`. Status letters are A available, P programme, T training, B block booking, M maintenance, and S sessional break. A missing Excel file is tried once as PDF.

Coordinates that are missing or outside Hong Kong are kept as venues and left off the map. Five centres use a stored Google Maps point: Hiu Kwong Street Sports Centre, Sham Shui Po Sports Centre, Tung Cheong Street Sports Centre, Choi Wing Road Sports Centre, and Ma Chai Hang Sports Centre. The government file lists Tung Cheong Street twice; the sync keeps the first row. A fitness room that is on the LCSD list but missing from the facility JSON, such as Ma Chai Hang Sports Centre (detail id 3171), is still stored. Its area and equipment are read from the details page.

Simplified Chinese text is generated with OpenCC. It is not downloaded.

The public Update button inserts one `SyncRun` row. A second click during a run does nothing. A finished run cannot be repeated from the button for 10 minutes. `python manage.py sync_fitness_rooms` runs immediately and skips that wait.

## Database tables

- `fitness_venue` — names, addresses, phone, location, location quality
- `fitness_venue_room` — one row per published room size
- `fitness_equipment` — equipment, quantity, shared use
- `fitness_opening_slot` — one status for a venue, room, date, and start time
- `fitness_timetable` — quotas, issue date, source URL, file hash, and any file error
- `fitness_sync_run` — queued, running, success, or failed, plus the log and counts

Equipment categories are not stored. The detail drawer groups each English equipment name into one of ten categories when the page is rendered.
