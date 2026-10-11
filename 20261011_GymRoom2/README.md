# LCSD fitness rooms

Map of Leisure and Cultural Services Department fitness rooms on an OpenFreeMap background, in Traditional Chinese, Simplified Chinese, and English.

Start Docker Desktop. The first time, from this project folder (`X:\MiniProjects\20261011_GymRoom2`):

```
copy .env.example .env
docker compose up --build -d
```

Then open http://127.0.0.1:8000/

Later, switch it on with `docker compose up -d` and switch it off with `docker compose stop`, both from that folder. The database is kept.

The database viewer is http://127.0.0.1:8000/admin/. The username and password are `DJANGO_SUPERUSER_USERNAME` and `DJANGO_SUPERUSER_PASSWORD` in `.env`. The defaults are `admin` and `gymrooms-admin`. After you change them, run `docker compose up -d --force-recreate web`.

Press **Update data** on the map to download locations, equipment, and the current and next month's timetables. A run already in progress is left alone, and a finished run cannot be repeated for 10 minutes. To load data from the command line without that wait:

```
docker compose exec web python manage.py sync_fitness_rooms
```

- [Technical specification](docs/TECHNICAL.md) — language, services, packages, and the government files the sync reads.
- [Install, GitHub, and GCP](docs/DEPLOY.md) — local setup, pushing the repository, a Compute Engine VM, HTTPS, and how to update the VM.
