# -*- coding: utf-8 -*-
"""
Created on Thu Jan 31 10:42:54 2019

@author: KY
"""

import os
import csv
import re
import time
import urllib.request, urllib.parse, urllib.error
from itertools import chain
from pathlib import Path
import ssl
import pandas as pd
from bs4 import BeautifulSoup
from GeoAPI import *

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None


def get_google_api_key():
    if load_dotenv is not None:
        load_dotenv()

    api_key = os.getenv('GOOGLE_MAPS_API_KEY', '').strip()
    if not api_key:
        raise ValueError(
            'Missing GOOGLE_MAPS_API_KEY. Please add it to your .env file or environment variables.'
        )
    return api_key


class GymRoomScraper:
    base_url = 'https://www.lcsd.gov.hk/clpss/tc/webApp/FitnessRooms.do'
    unresolved_sub_category = '未能由名稱可靠判斷'

    def __init__(self):
        self.base_dir = Path(__file__).resolve().parent
        self.api_key = get_google_api_key()
        self.facility_group_mapping = self.load_facility_group_mapping()
        self.ctx = self.create_ssl_context()

    def create_ssl_context(self):
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx

    def load_facility_group_mapping(self):
        mapping_path = self.base_dir / 'facility_names_factory' / 'facility_names_standardized.csv'
        if not mapping_path.exists():
            raise FileNotFoundError(f'Facility mapping file not found: {mapping_path}')

        mapping = {}
        with mapping_path.open(encoding='utf-8-sig', newline='') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                original_name = row.get('original_name', '').strip()
                sub_category = row.get('sub_category', '').strip()
                if not original_name or not sub_category or sub_category == self.unresolved_sub_category:
                    continue
                mapping[original_name] = sub_category

        return mapping

    def group_facility_name(self, name):
        return self.facility_group_mapping.get(name)

    def fetch_html(self, url, referer=None, retries=3, timeout=20):
        headers = {
            'User-Agent': (
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                'AppleWebKit/537.36 (KHTML, like Gecko) '
                'Chrome/126.0.0.0 Safari/537.36'
            ),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-HK,zh-TW;q=0.9,zh;q=0.8,en-US;q=0.7,en;q=0.6',
            'Connection': 'keep-alive',
        }
        if referer:
            headers['Referer'] = referer

        last_error = None
        for attempt in range(1, retries + 1):
            try:
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req, context=self.ctx, timeout=timeout) as resp:
                    return resp.read().decode('utf-8', errors='ignore')
            except urllib.error.HTTPError as err:
                last_error = err
                if err.code in (403, 429) and attempt < retries:
                    time.sleep(attempt)
                    continue
                raise
            except urllib.error.URLError as err:
                last_error = err
                if attempt < retries:
                    time.sleep(attempt)
                    continue
                raise

        raise RuntimeError(f'Failed to retrieve URL: {url}. Last error: {last_error}')

    def fetch_listing_rows(self):
        print('Retrieving', self.base_url)
        html = self.fetch_html(self.base_url)
        soup = BeautifulSoup(html, 'html.parser')
        tags_tbody = soup('tbody')
        tags_tr = list(chain(*[tag_tbody.find_all('tr') for tag_tbody in tags_tbody]))
        print(f'The no. of tags = {len(tags_tr)}')
        return tags_tr

    def build_basic_row(self, tag_tr):
        row = {
            'venue': tag_tr.find(class_='venu').text.strip(),
            'address': tag_tr.find(class_='addr').text.strip(),
            'tel': tag_tr.find(class_='tel').text.strip(),
        }

        geojs = getGeojs(row['address'], self.api_key)
        if not geojs:
            geojs = getGeojs(row['venue'], self.api_key)

        try:
            row['lat'] = geojs['results'][0]['geometry']['location']['lat']
            row['long'] = geojs['results'][0]['geometry']['location']['lng']
        except Exception:
            row['lat'] = None
            row['long'] = None

        href = tag_tr.find(class_='detail').find('a').get('href')
        row['href'] = href

        from urllib.parse import parse_qs, urlparse

        row['id'] = parse_qs(urlparse(href).query)['id'][0]
        return row

    def fetch_facility_details(self, row):
        url_next = urllib.parse.urljoin(self.base_url, row['href'])
        print('Retrieving for', row['venue'], url_next)
        html_next = self.fetch_html(url_next, referer=self.base_url)
        soup_next = BeautifulSoup(html_next, 'html.parser')

        tags_divrow = soup_next('div', class_='row')
        area = tags_divrow[0].find('h2').text
        row['area'] = float(re.findall('[0-9]+', area)[0])

        tags_tools_tr = tags_divrow[0].find_all('tr')
        dict_tools = {
            tag.find_all('span')[0].text.strip(): int(tag.find_all('span')[1].text.strip())
            for tag in tags_tools_tr
            if len(tag.find_all('span')) == 2
        }
        return dict_tools

    def build_grouped_tools(self, dict_tools):
        grouped_tools = {}
        for key, value in dict_tools.items():
            grouped_key = self.group_facility_name(key)
            if not grouped_key:
                continue
            grouped_tools[grouped_key] = grouped_tools.get(grouped_key, 0) + value
        return grouped_tools

    def append_mapped_facilities(self, row, grouped_tools):
        for key, value in sorted(grouped_tools.items()):
            row[key] = value

    def scrape(self):
        rows = []
        all_facility_names = set()

        for tag_tr in self.fetch_listing_rows():
            row = self.build_basic_row(tag_tr)
            dict_tools = self.fetch_facility_details(row)
            grouped_tools = self.build_grouped_tools(dict_tools)
            all_facility_names.update(grouped_tools.keys())
            self.append_mapped_facilities(row, grouped_tools)
            rows.append(row)

        return rows, all_facility_names

    def write_outputs(self, rows, all_facility_names):
        df = pd.DataFrame(rows)
        df.to_csv(self.base_dir / 'df.csv', index=False)
        print(f'Having written df.csv . Shape = {df.shape}')

        df_facility_names = pd.DataFrame({'facility_name': sorted(all_facility_names)})
        df_facility_names.to_csv(self.base_dir / 'facility_names.csv', index=False, encoding='utf-8-sig')
        print(f'Having written facility_names.csv . Count = {len(df_facility_names)}')

    def run(self):
        rows, all_facility_names = self.scrape()
        self.write_outputs(rows, all_facility_names)


def main():
    GymRoomScraper().run()


if __name__ == '__main__':
    main()
    


#
#fwrite = open('soup_out.txt', 'w', encoding="utf-8")
#fwrite.writelines(soup_next.prettify())
#fwrite.close()
#print('Having written', 'soup_out.txt')
