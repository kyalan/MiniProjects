# -*- coding: utf-8 -*-
"""
Sync a local CSV file to Google Sheets.

Quick start
1) Create a Google Cloud service account and download its JSON key.
2) Enable Google Drive API and Google Sheets API.
3) Share your target Google Drive folder or spreadsheet with the service-account email.
4) Install dependencies:
   pip install pandas gspread gspread-dataframe google-api-python-client google-auth python-dotenv
5) Run:
   python sync_df_to_gsheet.py --csv-path df.csv --worksheet-title df

You can also use environment variables (optionally loaded from .env):
- GOOGLE_SERVICE_ACCOUNT_FILE
- GSHEET_SPREADSHEET_ID
- GSHEET_SPREADSHEET_TITLE
- GSHEET_WORKSHEET_TITLE
- GDRIVE_FOLDER_ID
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
import gspread
from gspread.exceptions import WorksheetNotFound
from gspread_dataframe import set_with_dataframe

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sync a CSV file to Google Sheets")
    parser.add_argument("--csv-path", default="df.csv", help="Path to local CSV file")
    parser.add_argument(
        "--service-account-file",
        default=os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", ""),
        help="Path to Google service account JSON key file",
    )
    parser.add_argument(
        "--spreadsheet-id",
        default=os.getenv("GSHEET_SPREADSHEET_ID", ""),
        help="Target spreadsheet ID (preferred if known)",
    )
    parser.add_argument(
        "--spreadsheet-title",
        default=os.getenv("GSHEET_SPREADSHEET_TITLE", "LCSD Gym Data"),
        help="Spreadsheet title used when searching/creating by name",
    )
    parser.add_argument(
        "--worksheet-title",
        default=os.getenv("GSHEET_WORKSHEET_TITLE", "df"),
        help="Worksheet name to overwrite",
    )
    parser.add_argument(
        "--drive-folder-id",
        default=os.getenv("GDRIVE_FOLDER_ID", ""),
        help="Optional Drive folder ID where spreadsheet should exist/be created",
    )
    parser.add_argument(
        "--create-if-missing",
        action="store_true",
        help="Create spreadsheet when not found by ID/title",
    )
    return parser.parse_args()


def get_credentials(service_account_file: str) -> Credentials:
    if not service_account_file:
        raise ValueError("Missing service-account file. Set --service-account-file or GOOGLE_SERVICE_ACCOUNT_FILE.")

    key_path = Path(service_account_file)
    if not key_path.exists():
        raise FileNotFoundError(f"Service-account file not found: {key_path}")

    return Credentials.from_service_account_file(str(key_path), scopes=SCOPES)


def _escape_drive_query_text(value: str) -> str:
    return value.replace("'", "\\'")


def find_spreadsheet_id_by_title(
    drive_service,
    spreadsheet_title: str,
    folder_id: str = "",
) -> str:
    escaped_title = _escape_drive_query_text(spreadsheet_title)
    query_parts = [
        "mimeType='application/vnd.google-apps.spreadsheet'",
        "trashed=false",
        f"name='{escaped_title}'",
    ]
    if folder_id:
        query_parts.append(f"'{folder_id}' in parents")

    query = " and ".join(query_parts)
    resp = (
        drive_service.files()
        .list(q=query, fields="files(id,name)", pageSize=1)
        .execute()
    )
    files = resp.get("files", [])
    return files[0]["id"] if files else ""


def create_spreadsheet(
    sheets_service,
    drive_service,
    spreadsheet_title: str,
    folder_id: str = "",
) -> str:
    create_body = {"properties": {"title": spreadsheet_title}}
    created = (
        sheets_service.spreadsheets()
        .create(body=create_body, fields="spreadsheetId")
        .execute()
    )
    spreadsheet_id = created["spreadsheetId"]

    if folder_id:
        meta = drive_service.files().get(fileId=spreadsheet_id, fields="parents").execute()
        current_parents = ",".join(meta.get("parents", []))
        drive_service.files().update(
            fileId=spreadsheet_id,
            addParents=folder_id,
            removeParents=current_parents,
            fields="id,parents",
        ).execute()

    return spreadsheet_id


def get_or_create_spreadsheet_id(
    drive_service,
    sheets_service,
    spreadsheet_id: str,
    spreadsheet_title: str,
    folder_id: str,
    create_if_missing: bool,
) -> str:
    if spreadsheet_id:
        return spreadsheet_id

    found_id = find_spreadsheet_id_by_title(drive_service, spreadsheet_title, folder_id)
    if found_id:
        return found_id

    if not create_if_missing:
        raise ValueError(
            "Spreadsheet not found by title and --create-if-missing is not set. "
            "Provide --spreadsheet-id or enable creation."
        )

    return create_spreadsheet(sheets_service, drive_service, spreadsheet_title, folder_id)


def upsert_worksheet(spreadsheet, worksheet_title: str):
    try:
        return spreadsheet.worksheet(worksheet_title)
    except WorksheetNotFound:
        return spreadsheet.add_worksheet(title=worksheet_title, rows=1000, cols=26)


def sync_csv_to_worksheet(csv_path: Path, worksheet) -> tuple[int, int]:
    df = pd.read_csv(csv_path)
    df = df.fillna("")

    worksheet.clear()
    set_with_dataframe(
        worksheet,
        df,
        include_index=False,
        include_column_header=True,
        resize=True,
    )
    return df.shape


def main():
    load_dotenv()
    args = parse_args()

    csv_path = Path(args.csv_path)
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")

    credentials = get_credentials(args.service_account_file)
    gc = gspread.authorize(credentials)
    drive_service = build("drive", "v3", credentials=credentials)
    sheets_service = build("sheets", "v4", credentials=credentials)

    target_spreadsheet_id = get_or_create_spreadsheet_id(
        drive_service=drive_service,
        sheets_service=sheets_service,
        spreadsheet_id=args.spreadsheet_id.strip(),
        spreadsheet_title=args.spreadsheet_title.strip(),
        folder_id=args.drive_folder_id.strip(),
        create_if_missing=args.create_if_missing,
    )

    spreadsheet = gc.open_by_key(target_spreadsheet_id)
    worksheet = upsert_worksheet(spreadsheet, args.worksheet_title.strip())
    rows, cols = sync_csv_to_worksheet(csv_path, worksheet)

    print("Sync complete")
    print(f"Spreadsheet ID: {target_spreadsheet_id}")
    print(f"Worksheet: {worksheet.title}")
    print(f"Rows x Cols written: {rows} x {cols}")


if __name__ == "__main__":
    main()
