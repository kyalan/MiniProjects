import re

from bs4 import BeautifulSoup

REGION_BY_ANCHOR = {
    "dist1": "hk_island",
    "dist2": "kowloon",
    "dist3": "nt",
}


def html_text(value) -> str:
    text = str(value or "")
    text = re.sub(r"(?i)<br\s*/?>", " ", text)
    text = re.sub(r"(?i)<sup>\s*2\s*</sup>", "2", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("&nbsp;", " ").replace("&amp;", "&").replace("\u3000", " ")
    return re.sub(r"\s+", " ", text).strip()


def norm_key(value: str | None) -> str:
    return html_text(value).casefold()


def parse_row(tr) -> dict | None:
    name_el = tr.select_one("td.venu")
    link = tr.select_one("td.detail a")
    if not name_el or not link:
        return None
    match = re.search(r"id=(\d+)", link.get("href") or "")
    if not match:
        return None
    detail_td = tr.select_one("td.detail")
    accessible = "*" in (detail_td.get_text() if detail_td else "")
    address_el = tr.select_one("td.addr")
    phone_el = tr.select_one("td.tel")
    return {
        "name": name_el.get_text(" ", strip=True),
        "address": html_text(address_el.get_text(" ", strip=True) if address_el else ""),
        "phone": html_text(phone_el.get_text(" ", strip=True) if phone_el else ""),
        "detail_id": int(match.group(1)),
        "accessible": accessible,
    }


def parse_listing(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    rows: list[dict] = []
    region = ""
    for table in soup.select("table.fitness_tb"):
        anchors = table.select("a[name]")
        if len(anchors) > 1:
            region = ""
            for element in table.find_all(["thead", "tbody"]):
                anchor = element.find("a", attrs={"name": True})
                if anchor and anchor.get("name") in REGION_BY_ANCHOR:
                    region = REGION_BY_ANCHOR[anchor["name"]]
                if element.name != "tbody":
                    continue
                for tr in element.find_all("tr", recursive=False):
                    parsed = parse_row(tr)
                    if parsed:
                        parsed["region"] = region
                        rows.append(parsed)
            continue
        if anchors and anchors[0].get("name") in REGION_BY_ANCHOR:
            region = REGION_BY_ANCHOR[anchors[0]["name"]]
        for tr in table.select("tbody tr"):
            parsed = parse_row(tr)
            if parsed:
                parsed["region"] = region
                rows.append(parsed)
    return rows


def parse_room_page(html: str) -> dict:
    """Read floor area and equipment from a fitness-room details page.

    Used when a room is on the LCSD list but missing from the facility JSON.
    """
    soup = BeautifulSoup(html or "", "html.parser")
    size = ""
    for heading in soup.find_all("h2"):
        text = html_text(heading.get_text(" ", strip=True))
        if re.search(r"\d", text) and re.search(r"m|米", text, re.IGNORECASE):
            size = text
            break
    equipment: list[dict] = []
    for table in soup.find_all("table"):
        body_rows = table.find_all("tr")
        if len(body_rows) < 2:
            continue
        header = html_text(body_rows[0].get_text(" ", strip=True)).casefold()
        if "equipment" not in header and "器械" not in header:
            continue
        for tr in body_rows[1:]:
            cells = tr.find_all("td")
            if len(cells) < 2:
                continue
            name = html_text(cells[0].get_text(" ", strip=True))
            if not name:
                continue
            quantity_text = html_text(cells[1].get_text(" ", strip=True))
            quantity_match = re.search(r"\d+", quantity_text)
            equipment.append(
                {
                    "name": name,
                    "quantity": int(quantity_match.group(0)) if quantity_match else 1,
                }
            )
        break
    return {"size": size, "equipment": equipment}
