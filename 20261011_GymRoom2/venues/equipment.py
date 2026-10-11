"""Group LCSD equipment names into at most ten categories.

The first matching rule wins. Names that match none of the first nine rules
are reported as other equipment.
"""

# Product names that do not contain the word "elliptical".
_FIRST = (
    ("elliptical", ("natural runner", "arc trainer")),
)

_RULES = (
    ("treadmill", ("treadmill", "running")),
    ("bike", ("bike", "bicycle", "cycle", "spinning")),
    ("elliptical", ("elliptical", "cross-train", "cross trainer", "crosstrainer")),
    ("rowing", ("rowing", "rower")),
    ("free_weights", ("dumbbell", "barbell", "bench", "plate", "kettlebell")),
    ("upper_body", ("chest", "shoulder", "fly", "pec", "lat", "pulldown", "arm curl", "biceps", "triceps")),
    ("lower_body", ("leg press", "leg curl", "leg extension", "calf", "hip", "thigh")),
    ("core", ("abdominal", "abs", "torso", "back extension", "leg raise", "sit-up", "sit up")),
    ("cable", ("pulley", "cable", "smith", "multi")),
)

CATEGORY_ORDER = tuple(key for key, _words in _RULES) + ("other",)

# A drawing that is more specific than the category, when the English name says so.
_ICON_RULES = (
    ("kettlebell", ("kettlebell",)),
    ("dumbbell", ("dumbbell",)),
    ("barbell", ("barbell", "plate")),
    ("bench", ("bench",)),
)


def equipment_category(name: str | None) -> str:
    text = (name or "").casefold()
    for key, words in _FIRST + _RULES:
        if any(word in text for word in words):
            return key
    return "other"


def equipment_icon(name: str | None) -> str:
    text = (name or "").casefold()
    for key, words in _ICON_RULES:
        if any(word in text for word in words):
            return key
    return equipment_category(name)
