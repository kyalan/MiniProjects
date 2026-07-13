# LCSD Gym Room Dashboard

A backend data pipeline that scrapes public gym room information from the Hong Kong Leisure and Cultural Services Department (LCSD), enriches it with geolocation and district data, and feeds a Tableau Public dashboard.

**Live Dashboard:** [LCSD Gym on Tableau Public](https://public.tableau.com/app/profile/kyalan/viz/LCSDGym/Gym)

---

## Project Overview

```
LCSD Website ──────────────────────────────────────────────┐
                                                           ▼
                                                      df.csv
                                                           │
Google Maps Geocoding API ─── (lat/long per venue) ────────┤
facility_names_standardized.csv ─ (original name → sub_category) ─┤
                          │
                          ▼
                  sync_df_to_gsheet.py
                          │
                          ▼
                     Google Spreadsheet
                                                           │
                                                           ▼
                                               district identifier.ipynb
                                                           │
HK Gov Coordinates Transformation API ─── (WGS84→HK1980) ─┤
DCCA 2019 Shapefile ──────────── (point-in-polygon match) ─┤
                                                           │
                                                           ▼
                                                    df_dist.csv
                                                           │
                                               ┌───────────┘
                                               ▼
                                       Tableau Public
```

---

## Files

| File | Description |
|---|---|
| `20190131_GymRoom.py` | Main scraper (class-based) — collects gym data, geocodes each venue, and maps equipment into standard `sub_category` columns |
| `GeoAPI.py` | Helper module wrapping the Google Maps Geocoding API |
| `GeoAPI_debug.py` | Quick test script to verify `GeoAPI.py` is working correctly |
| `facility_names_factory/facility_names_standardized.csv` | Mapping table from raw equipment names (`original_name`) to normalized `sub_category` |
| `sync_df_to_gsheet.py` | Utility script to upload `df.csv` into a Google Spreadsheet in Google Drive |
| `district identifier.ipynb` | Assigns each venue a HK district and region using the DCCA shapefile |
| `HK District Identifier (not completed).ipynb` | Exploratory notebook for prototyping HK geodata APIs (incomplete) |
| `df.csv` | Output of the scraper: gym details, coordinates, and equipment counts by normalized `sub_category` |
| `df_dist.csv` | Output of the district identifier: venue-to-district/region mapping |
| `DCCA_2019_Shapefile/` | Hong Kong District Council Constituency Areas (DCCA) 2019 shapefile |

---

## Pipeline Steps

### Step 1 — Scrape LCSD Gym Data (`20190131_GymRoom.py`)

- **Gym listings:** [LCSD Fitness Rooms (data.gov.hk)](https://www.lcsd.gov.hk/clpss/tc/webApp/FitnessRooms.do)
- **Shapefile:** [DCCA 2019 — Hong Kong District Council Constituency Areas](https://data.gov.hk/) from the Electoral Affairs Commission
- Extracts **venue name**, **address**, and **telephone number**
- Geocodes the address via **Google Maps Geocoding API** (`GeoAPI.py`) to get **latitude/longitude**
  - Falls back to querying the venue name if the address geocoding fails
- Visits each venue's detail page to extract:
  - **Floor area** (m²)
  - **Equipment counts**
- Maps raw equipment names to standardized categories using `facility_names_factory/facility_names_standardized.csv`:
  - Uses `original_name -> sub_category`
  - Skips rows where `sub_category` is `未能由名稱可靠判斷`

Output: **`df.csv`**

| Column | Description |
|---|---|
| `venue` | Venue name (Chinese) |
| `address` | Street address (Chinese) |
| `tel` | Telephone number |
| `lat` / `long` | WGS84 coordinates from Google Maps |
| `href` / `id` | LCSD detail page link and venue ID |
| `area` | Floor area in m² |
| `<sub_category>` columns | Normalized equipment categories from `facility_names_standardized.csv` (e.g. `跑步類`, `單車類`, `上肢拉－垂直下拉`) |

### Step 2 — Assign District & Region (`district identifier.ipynb`)

Takes `df.csv` and identifies the **18 HK district** and **region** for each venue:

1. Loads the **DCCA 2019 Shapefile** (HK1980 coordinate system)
2. For each venue, calls the **HK Government Coordinates Transformation API** to convert WGS84 lat/long → HK1980 grid coordinates
3. Uses **Shapely** point-in-polygon matching against the DCCA shapefile to find which constituency area the venue falls in
4. Maps the DCCA code prefix letter to a district name and one of five regions

**District code prefix → Region mapping:**

| Letters | Region |
|---|---|
| A, B, C, D | 港島 (Hong Kong Island) |
| E, F, G | 九龍西 (West Kowloon) |
| H, J | 九龍東 (East Kowloon) |
| K, L, M, S, T | 新界西 (West New Territories) |
| N, P, Q, R | 新界東 (East New Territories) |

Output: **`df_dist.csv`**

| Column | Description |
|---|---|
| `venue` | Venue name |
| `district` | One of 18 HK districts (Chinese) |
| `region` | One of 5 regions (Chinese) |

### Step 3 — (Optional) Sync `df.csv` to Google Sheets (`sync_df_to_gsheet.py`)

Use the utility script to upload `df.csv` to a specific Google Spreadsheet.

- Auth via Google service account JSON key
- Finds spreadsheet by ID (or by title)
- Creates worksheet if missing
- Clears worksheet and writes full CSV

### Step 4 — Tableau Visualisation

`df.csv` and `df_dist.csv` are joined in Tableau Public to produce the dashboard, visualising gym locations, equipment availability, and floor area by district and region.

---

## Setup & Usage

### Prerequisites

```
pip install requests beautifulsoup4 pandas geopandas shapely python-dotenv
```

### Run the scraper

```bash
python 20190131_GymRoom.py
```

Set your Google Maps key in `.env` or environment variable first:

```bash
GOOGLE_MAPS_API_KEY=your_key_here
```

The script outputs `df.csv` and `facility_names.csv`.

### Sync `df.csv` to Google Sheets (optional)

Install dependencies:

```bash
pip install pandas gspread gspread-dataframe google-api-python-client google-auth python-dotenv
```

Run:

```bash
python sync_df_to_gsheet.py --csv-path df.csv --spreadsheet-id <YOUR_SPREADSHEET_ID> --worksheet-title df
```

Required setup:

1. Enable Google Sheets API and Google Drive API in Google Cloud
2. Create service account and download JSON key
3. Share target spreadsheet (or folder) with the service account email
4. Set `GOOGLE_SERVICE_ACCOUNT_FILE` to the JSON key path

### Run the district identifier

Open `district identifier.ipynb` in Jupyter and run all cells. The script reads `df.csv` and outputs `df_dist.csv`.

### API Keys & External Services

| Service | Used in | Purpose |
|---|---|---|
| [Google Maps Geocoding API](https://developers.google.com/maps/documentation/geocoding) | `20190131_GymRoom.py` | Convert venue address → WGS84 lat/long |
| [Google Sheets API](https://developers.google.com/sheets/api) | `sync_df_to_gsheet.py` | Write `df.csv` into Google Sheets |
| [Google Drive API](https://developers.google.com/drive/api) | `sync_df_to_gsheet.py` | Locate/create spreadsheet in Google Drive |
| [HK Gov Coordinates Transformation API](https://data.gov.hk/en-data/dataset/hk-landsd-openmap-coordinates-transformation-api) | `district identifier.ipynb` | Convert WGS84 → HK1980 Grid |

---

## Data Source

- **Gym listings:** [LCSD Fitness Rooms (data.gov.hk)](https://www.lcsd.gov.hk/clpss/tc/webApp/FitnessRooms.do)
- **Shapefile:** [DCCA 2019 — Hong Kong District Council Constituency Areas](https://data.gov.hk/) from the Electoral Affairs Commission
