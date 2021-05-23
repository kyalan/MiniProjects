# -*- coding: utf-8 -*-
"""
Created on Thu Jan 31 10:42:54 2019

@author: KY
"""

import os
import re
import urllib.request, urllib.parse, urllib.error
from bs4 import BeautifulSoup
import ssl
from GeoAPI import *

api_key = input('Please input your google API key:')
print('\n')

# Ignore SSL certificate errors
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

url = 'https://www.lcsd.gov.hk/clpss/tc/webApp/FitnessRooms.do'
print('Retrieving', url)
html = urllib.request.urlopen(url, context=ctx).read().decode()
soup = BeautifulSoup(html, 'html.parser')


tags_tbody = soup('tbody')

from itertools import chain
tags_tr = list(chain(*[tag_tbody.find_all('tr') for tag_tbody in tags_tbody]))
print(f'The no. of tags = {len(tags_tr)}')

rows = []
for tag_tr in tags_tr:
    row = {}
    row['venue'] = tag_tr.find(class_='venu').text.strip()
    row['address'] = tag_tr.find(class_='addr').text.strip()
    row['tel'] = tag_tr.find(class_='tel').text.strip()
    
    geojs = getGeojs(row['address'], api_key)
    if not geojs:  geojs = getGeojs(row['venue'], api_key)
    try:
        row['lat'] = geojs['results'][0]['geometry']['location']['lat']
        row['long'] = geojs['results'][0]['geometry']['location']['lng']
    except:
        row['lat'] = None
        row['long'] = None
    
    href = tag_tr.find(class_='detail').find('a').get('href')
    row['href'] = href
    
    from urllib.parse import urlparse, parse_qs
    row['id'] = parse_qs(urlparse(href).query)['id'][0]
    
    url_next = urllib.parse.urljoin(url, href)
    print('Retrieving for', row['venue'],  url_next)
    html_next = urllib.request.urlopen(url_next, context=ctx).read().decode()
    soup_next = BeautifulSoup(html_next, 'html.parser')
    
    tags_divrow = soup_next('div', class_='row')

    area = tags_divrow[0].find('h2').text
    row['area'] = float(re.findall('[0-9]+', area)[0])
    tags_tools_tr = tags_divrow[0].find_all('tr')
    dict_tools = {tag.find_all('span')[0].text.strip() : int(tag.find_all('span')[1].text.strip()) \
         for tag in tags_tools_tr \
         if len(tag.find_all('span'))==2}
#    for key, value in dict_tools.items():
    keys = ['橢圓運轉機', '弧形訓練器', '划艇機', '跑步機', '運轉機', '滑雪機', '弧步運轉機']
    keys_cycle = ['橢圓運轉機', '弧形訓練器', '運轉機', '滑雪機', '弧步運轉機']
    for key in keys:
        if key in keys_cycle:
            row['滑雪機'] = row.get('滑雪機', 0) + dict_tools.get(key, 0)
        else:
            row[key] = dict_tools.get(key, 0)
    
    rows.append(row)

#print(rows)
    
import pandas as pd
df = pd.DataFrame(rows)
df.to_csv('df.csv', index=False)
print(f'Having written df.csv . Shape = {df.shape}')
    


#
#fwrite = open('soup_out.txt', 'w', encoding="utf-8")
#fwrite.writelines(soup_next.prettify())
#fwrite.close()
#print('Having written', 'soup_out.txt')
