# -*- coding: utf-8 -*-
"""
Created on Mon Feb  4 12:36:16 2019

@author: KY
"""

from GeoAPI import *

api_key = input('Please input your google API key:')

address = 'Lady Shaw Building, Hong Kong'
geojs = getGeojs(address, api_key, verbose=True)

print('Place id', geojs['results'][0]['place_id'])

try:
    lat = geojs['results'][0]['geometry']['location']['lat']
    lng = geojs['results'][0]['geometry']['location']['lng']
except:
    lat = None
    lng = None

print('lat', lat, 'lng', lng)
location = geojs['results'][0]['formatted_address']
print(location)