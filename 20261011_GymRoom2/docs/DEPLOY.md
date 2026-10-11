# Install, GitHub, and a GCP virtual machine

## Install on this computer

Install Docker Desktop and leave it running. The first time, from this project folder (`X:\MiniProjects\20261011_GymRoom2`):

```
copy .env.example .env
docker compose up --build -d
```

Open http://127.0.0.1:8000/

The first start creates empty tables. Press **Update data** on the map, or load the files from the command line:

```
docker compose exec web python manage.py sync_fitness_rooms
```

### Switch it on and off

From the same folder, after the first build:

```
docker compose up -d
```

Open http://127.0.0.1:8000/. The database viewer is http://127.0.0.1:8000/admin/.

To switch it off without deleting the database:

```
docker compose stop
```

### Admin username and password

Set these in `.env` in the project folder. Docker Compose reads that file. The defaults are username `admin` and password `gymrooms-admin`.

```
DJANGO_SUPERUSER_USERNAME=admin
DJANGO_SUPERUSER_PASSWORD=gymrooms-admin
DJANGO_SUPERUSER_EMAIL=admin@example.com
```

The web container creates or updates that user every time it starts. After a password change:

```
docker compose up -d --force-recreate web
```

Then sign in at http://127.0.0.1:8000/admin/

`POSTGRES_PASSWORD` is used only when the database volume is first created. Changing it later does not change the password inside an existing volume. `DJANGO_SECRET_KEY` should be a long random string before the site is public. Set `DJANGO_DEBUG=0` and put the public host in `DJANGO_ALLOWED_HOSTS`.

“Near me” works on `localhost`. A public address needs HTTPS, which the virtual-machine section sets up.

## Push this project to GitHub

This folder should be its own Git repository, not a subfolder of a larger one, so the virtual machine can clone only this app.

From the project folder, if `git rev-parse --show-toplevel` does not print this folder, start a repository here:

```
git init
git add .
git commit -m "Initial LCSD fitness-room map"
```

Create an empty GitHub repository, then:

```
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git branch -M main
git push -u origin main
```

Do not commit `.env`. It is listed in `.gitignore`. Commit `.env.example` instead.

## Deploy on a GCP virtual machine

Use a Compute Engine VM, not Cloud Run. An `e2-small` machine with a 30 GB Ubuntu disk is enough. Allow HTTP and HTTPS when you create it, or add firewall rules `tcp:80` and `tcp:443` later. The map itself does not need port 8000 open to the internet.

SSH into the VM and install Docker:

```
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker $USER
```

Log out and back in so the `docker` group applies. Clone the repository and configure it:

```
git clone https://github.com/YOUR_USER/YOUR_REPO.git gymrooms
cd gymrooms
cp .env.example .env
```

Edit `.env`:

- `DJANGO_SECRET_KEY` — a long random string
- `DJANGO_DEBUG=0`
- `DJANGO_ALLOWED_HOSTS` — the domain, and the VM IP if you also open the site by IP
- `DJANGO_SUPERUSER_USERNAME` and `DJANGO_SUPERUSER_PASSWORD`
- `POSTGRES_PASSWORD` — not the default

Start the app on the VM’s localhost only by changing the published port in `docker-compose.yml` from `"8000:8000"` to `"127.0.0.1:8000:8000"`, then:

```
docker compose up --build -d
docker compose exec web python manage.py sync_fitness_rooms
```

### HTTPS

Browsers refuse “Near me” on a plain `http://` IP address. Put Caddy in front of Gunicorn and give the VM a domain name whose DNS A record points at the VM.

```
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update
sudo apt-get install -y caddy
```

Replace the contents of `/etc/caddy/Caddyfile`:

```
your.domain.example {
    reverse_proxy 127.0.0.1:8000
}
```

```
sudo systemctl reload caddy
```

Caddy obtains the certificate. Open https://your.domain.example/ and sign in at `/admin/`.

## Update the app on the VM

From the project folder on the VM:

```
git pull
docker compose up -d --build
```

That rebuilds the image, runs migrations, and keeps the PostgreSQL volume. Press **Update data** on the site, or run `docker compose exec web python manage.py sync_fitness_rooms`, when the government files themselves need refreshing. A code update does not by itself download new timetables.

If the admin password in `.env` changed:

```
docker compose up -d --force-recreate web
```
