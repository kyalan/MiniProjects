import glob
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def _library(pattern: str) -> str | None:
    matches = sorted(glob.glob(pattern))
    return matches[-1] if matches else None


SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "build-time-only-not-for-production")
DEBUG = os.environ.get("DJANGO_DEBUG", "0") == "1"
ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
    if host.strip()
]
# Cross-origin map tiles are rejected unless the browser sends this site as Referer.
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.gis",
    "venues",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "venues.middleware.DefaultLanguageMiddleware",
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "django.template.context_processors.i18n",
            ],
        },
    }
]

DATABASES = {
    "default": {
        "ENGINE": "django.contrib.gis.db.backends.postgis",
        "NAME": os.environ.get("POSTGRES_DB", "gymrooms"),
        "USER": os.environ.get("POSTGRES_USER", "gymrooms"),
        "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "gymrooms"),
        "HOST": os.environ.get("POSTGRES_HOST", "db"),
        "PORT": os.environ.get("POSTGRES_PORT", "5432"),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "zh-hant"
LANGUAGES = [
    ("zh-hant", "繁體中文"),
    ("zh-hans", "简体中文"),
    ("en", "English"),
]
LOCALE_PATHS = [BASE_DIR / "locale"]
TIME_ZONE = "Asia/Hong_Kong"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

if os.environ.get("GDAL_LIBRARY_PATH"):
    GDAL_LIBRARY_PATH = os.environ["GDAL_LIBRARY_PATH"]
else:
    _gdal = _library("/usr/lib/*/libgdal.so*")
    if _gdal:
        GDAL_LIBRARY_PATH = _gdal

if os.environ.get("GEOS_LIBRARY_PATH"):
    GEOS_LIBRARY_PATH = os.environ["GEOS_LIBRARY_PATH"]
else:
    _geos = _library("/usr/lib/*/libgeos_c.so*")
    if _geos:
        GEOS_LIBRARY_PATH = _geos

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}
