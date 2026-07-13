class Scarper:
    
    import ssl
    
    # Ignore SSL certificate errors
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE    
    
    def __init__(self):
        pass
    
    def crawl(self, url, verbose=False):
        import urllib.request, urllib.parse, urllib.error
        
        if verbose:    print('Retrieving', url)
        uh = urllib.request.urlopen(url, context=self.ctx)
        
        html = ''
        if uh.status==200:   html = uh.read().decode()
        if verbose:    print('Retrieved', len(html), 'characters')
            
        return html   
    
class Scarper_dorama(Scarper):
       
    service_url = 'http://dorama.info/drama/drama_season.php'
    column_names = ['TV', 'BC_time', 'BC_date', 'name', '_', 'rate', 'watch_rating', 'recommend_ppl', 'popularity', 'taiwan', 'actors']
    
    def __init__(self):
        super().__init__()
        
    def crawl(self, year, season, verbose=False):
        
        from bs4 import BeautifulSoup 
        import urllib.request, urllib.parse, urllib.error
        from datetime import date
        import pandas as pd        
        
        params = {
            'year':year
            , 'season':season
            , 'ut':0
            , 'fd':0
            , 'md':0
            , 'dk':1
        }

        url = self.service_url + '?' + urllib.parse.urlencode(params)
        scarper = Scarper()
        html = scarper.crawl(url, verbose)
        
        # Start pre-processing through BeautifulSoup
        soup = BeautifulSoup(html, 'html.parser')
        
        soup_table = soup.find_all("table", attrs={"class": "table_ss"})
        soup_rows = soup_table[0].find_all('tr', recursive=False)
        print(f'{len(soup_rows)} dramas have been detected.')
        
        data_rows = []

        for soup_row_raw in soup_rows:
            soup_row = soup_row_raw.find_all('td', recursive=False, attrs={'class': 'td_ss line_bot'})
            if len(soup_row)==0:    continue
            # soup_row[0] is drama name
            # soup_row[1] is drama preformance
            data_row = [word.strip() for tag in soup_row[0].find_all('td', attrs={'class': 'td2_g'}) for word in tag.text.replace('\n', '').split('\xa0')] + \
                [tag.text.replace('\n', '').strip() for tag in soup_row[1].find_all('td', attrs={'class': 'td2_g'})]
            # DQ-change: if the 0th element too long, then splited by space.
            if len(data_row[0])>10:
                data_row_0_new = data_row.pop(0).split()
                data_row = data_row_0_new + data_row

            if len(data_row) != len(self.column_names):
                if verbose:
                    print(f'column_names: {self.column_names}')
                    print(f'data_row: {data_row}')
                    print(f'length not match. SKIP.')
                continue
            dict_row = dict(zip(self.column_names, data_row))
            dict_row['year'] = year
            dict_row['season'] = season
            if dict_row['BC_date'][-2:].isdigit():
                dict_row['BC_date'] = date(year, int(dict_row['BC_date'][:2]), int(dict_row['BC_date'][-2:]))
            else:
                dict_row['BC_date'] = date(year, int(dict_row['BC_date'][:2]), 1)
            dict_row['BC_weekday'] = dict_row['BC_date'].isoweekday()
            data_rows.append(dict_row)        
            
        return pd.DataFrame(data_rows)
    
class Scarper_wiki(Scarper):
    
    service_url = 'https://zh.wikipedia.org/wiki/'
    
    def __init__(self):
        super().__init__()
        
    def crawl(self, year, verbose=False):
        
        from bs4 import BeautifulSoup 
        import urllib.request, urllib.parse, urllib.error
        from datetime import date
        import pandas as pd        
        import re
    
        url = self.service_url + urllib.parse.quote(f'日本劇集列表_({year}年)')
        
        scarper = Scarper()
        html = scarper.crawl(url, verbose)
        
        soup = BeautifulSoup(html, 'html.parser')
        soup_tables = soup.find_all(id=re.compile(str(year)), attrs={'class': 'mw-headline'})
        
        dict_rows = []
        for soup_table in soup_tables[0:4]:

            season = soup_tables.index(soup_table) + 1
            soup_rows = soup_table.find_next('table').find_all('tr')
            for soup_row in soup_rows[2:]:
                dict_row = {}
                soup_row_td = soup_row.find_all('td', recursive=False)

                dict_row = self.soup_row_preprocessor(soup_row_td, year, season)  
                dict_rows.append(dict_row)
                
        return pd.DataFrame(dict_rows)
    
    def soup_row_preprocessor(self, soup_row_td, year, season):

        import urllib.request, urllib.parse, urllib.error
        import sys
        
        dict_row = {}

        dict_row['date'] = self.get_text_br_spliter(str(soup_row_td[0]))
        dict_row['time'] = self.get_text_br_spliter(str(soup_row_td[1]))
        dict_row['weekday'] = soup_row_td[2].get_text(strip=True)

        str_temp = self.get_text_br_spliter(str(soup_row_td[3]))
        dict_row['name_zh'] = str_temp[0]
        dict_row['name_ja'] = str_temp[0]
        if len(str_temp)==2:    dict_row['name_ja'] = str_temp[1]
        url_wikis = [urllib.parse.urljoin(self.service_url, tag['href']) for tag in soup_row_td[3].find_all(href=True)]
        dict_row['url_wiki_zh'] = next((u for u in url_wikis if u.find('zh.wikipedia.org') > 0), None)
        dict_row['url_wiki_ja'] = self.get_url_wiki_ja(dict_row['name_ja'])

        dict_row['TV'] = self.get_text_br_spliter(str(soup_row_td[5]))
        dict_row['char_main'] = self.get_text_br_spliter(str(soup_row_td[6]))
        dict_row['char_others'] = soup_row_td[7].get_text(strip=True).replace('等', '').split('、')

        dict_row['url'] = None
        if soup_row_td[8].find('a'):    dict_row['url'] = soup_row_td[8].a['href']
        dict_row['theme_song'] = soup_row_td[9].get_text(strip=True)

        dict_row['year'] = year
        dict_row['season'] = season

        if dict_row['url_wiki_ja'] is not None:
            dict_row_individual_wiki = self.crawl_infobox(dict_row['url_wiki_ja'])
            dict_row.update(dict_row_individual_wiki)

        print('soup_row_preprocessor is completed.', f'{year} / {season}', dict_row['name_zh'], dict_row['name_ja'], dict_row['char_main'], f'Size = {sys.getsizeof(dict_row)}')

        return dict_row
    
    def get_text_br_spliter(self, html):
        from bs4 import BeautifulSoup, NavigableString, Tag

        soup = BeautifulSoup(html, 'html.parser')
        text = ''
        for child in soup.find_all()[0]:
            if isinstance(child, NavigableString):
                text += str(child).strip()
            elif isinstance(child, Tag):
                if child.name != 'br':
                    text += child.text.strip()
                else:
                    text += '\n'

        result = text.strip().split('\n')
        return result
    
    def crawl_infobox(self, url, verbose=False):

        import urllib.request, urllib.parse, urllib.error
        from datetime import date
        from Scarper import Scarper    
        
        if not url:    return {}

        scarper = Scarper()
        html = scarper.crawl(url, verbose)  

        from bs4 import BeautifulSoup 
        soup = BeautifulSoup(html, 'html.parser')

        infoboxes = soup.find_all('table', attrs={'class':'infobox'})
        if not infoboxes:    return {}    

        infobox_rows = []
        for infobox in infoboxes:
            if not infobox.find_all('tr', attrs={'class': 'noprint'}):    continue
            if 'テレビ番組' in infobox.find_all('tr', attrs={'class': 'noprint'})[0].a['title']:
                infobox_rows = infobox.find_all('tr')
                break    

        dict_rows = {}
        for infobox_row in infobox_rows:
            row_keys = infobox_row.find_all('th', attrs={'scope':'row'})
            if not row_keys:    continue
            row_key_bs = row_keys[0]
            row_key = self.get_text_br_spliter(str(row_key_bs))[0]

            row_value_bs = row_key_bs.find_next('td') 
            row_value = self.get_text_br_spliter(str(row_value_bs))
            dict_rows[row_key] = row_value

        return dict_rows
    
    def get_url_wiki_ja(self, name_ja, verbose=False):

        import urllib.request, urllib.parse, urllib.error
        from datetime import date
        from Scarper import Scarper

        import json

        service_url = 'https://ja.wikipedia.org/w/api.php'
        params = {
            'action': 'query'
            , 'list': 'search'
            , 'srsearch': f'{name_ja} ドラマ'
            , 'format': 'json'
            , 'srlimit': 1
        }

        url = service_url + '?' + urllib.parse.urlencode(params)

        scarper = Scarper()
        js = scarper.crawl(url, verbose)

        dict_js = json.loads(js)

        out_url = ''
        if dict_js["query"]["search"]:    
            out_url = 'https://ja.wikipedia.org/wiki/' + urllib.parse.quote(dict_js["query"]["search"][0]["title"])
        return out_url    