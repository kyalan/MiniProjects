import requests

USER_AGENT = "GymRoomMap/1.0 (local mirror of public LCSD fitness-room open data)"


def make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept": "*/*"})
    return session


def fetch_json(session: requests.Session, url: str):
    response = session.get(url, timeout=(10, 60))
    response.raise_for_status()
    return response.json()


def fetch_text(session: requests.Session, url: str) -> str:
    response = session.get(url, timeout=(10, 60))
    response.raise_for_status()
    if not response.encoding or response.encoding.lower() == "iso-8859-1":
        response.encoding = response.apparent_encoding or "utf-8"
    return response.text


def fetch_bytes(session: requests.Session, url: str) -> bytes | None:
    response = session.get(url, timeout=(10, 60))
    if response.status_code == 404:
        return None
    response.raise_for_status()
    return response.content
