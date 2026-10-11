class HansConverter:
    def __init__(self):
        from opencc import OpenCC

        self._converter = OpenCC("hk2s")

    def convert(self, text: str | None) -> str:
        cleaned = text or ""
        if not cleaned:
            return ""
        return self._converter.convert(cleaned)
