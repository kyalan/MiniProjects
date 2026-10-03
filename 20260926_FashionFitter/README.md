# Fashion Fitting Studio

A local fitting page. You add a face photo or an illustrated character, a dress code, and up to five previews. The page prices the Gemini call before you generate, then saves the photo, the prompts, and the previews under `data/sessions`. The API key is not saved.

One Node process serves the page and the API. It uses Gemini 3.1 Flash Image only.

Sign-in is required. Set `APP_LOGIN_ID` and `APP_LOGIN_PASSWORD` in `.env.local` before the page will open. See [Set the login](#set-the-login).

## Run it on this computer

You need Node.js 20 or newer.

```bash
npm install
```

Copy `.env.example` to `.env.local` and set your key and login:

```bash
GEMINI_API_KEY=
APP_LOGIN_ID=
APP_LOGIN_PASSWORD=
```

You can leave the Gemini key blank and paste the key into the page instead. Either way, the key is sent only to this process and then to Google. It is not written into `data/sessions`.

The login cannot be left blank. The studio stays on the sign-in page until both values are set and the process is restarted.

```bash
npm run dev
```

Open http://127.0.0.1:3000. The process listens on all interfaces of this computer, port 3000.

`npm test` runs the tests. `npm start` builds the page and serves that build.

## Set the login

The ID and password live only in `.env.local`, in the project folder next to `package.json`. That file is not committed.

```bash
APP_LOGIN_ID=the-name-you-want
APP_LOGIN_PASSWORD=a-long-password
```

Optional: `APP_SESSION_SECRET=` keeps you signed in across a restart. If you leave it blank, a restart asks you to sign in again.

Change the two login lines, save the file, then restart:

- On this computer, stop `npm run dev` and start it again.
- On the VM, `sudo systemctl restart fashion-fitter`.

The sign-in page repeats this. There is no account database and no second user.

## City, date, and temperature

The top of the page has two lines:

- **Fitting place** is the city chosen in the City dropdown. It shows that city's date, temperature, and timezone. Outfit prompts use this weather.
- **Your connection** is the public IP of the machine running the studio, with that place's date, temperature, and timezone.

The City dropdown lists major cities in East Asia, including Okinawa, Hualien, and Alishan. It starts on the listed city that matches this connection. Choose "Your location" to dress for the connection instead.

Age is a whole number of years, or blank. Height is a whole number of centimetres from 50 to 250. Weight is a whole number of kilograms from 20 to 300. The boxes take the number only. The unit is shown beside the box.

Colors open as a menu. Each name has a round preview of that color. Dress code opens as a menu. Rest the pointer on a name to read its short description. The reference photo is shown whole and scaled to fit the column.

If this machine is in Mainland China or Hong Kong, Generate stays off even when the dropdown names another city. The block follows the connection, not the fitting place.

## Estimated tokens

The receipt uses the Gemini 3.1 Flash Image paid rates published by Google:

- Input, text and image: $0.50 per million tokens
- Text output: $3 per million tokens
- Image output: $60 per million tokens
- A 1K output image is 1,120 tokens ($0.0672). A 2K output image is 1,680 tokens ($0.1008).

Before Gemini answers, each input image is stood in at 1,120 tokens. After you add an API key, Gemini counts the real input. That counted input is what the receipt uses. It is not raised up to 1,120 when the photo counts as fewer tokens. Thinking tokens are not in the estimate. When Gemini reports them, they are included in Actual this run, billed as text output.

## Gemini is not available in Hong Kong

This studio calls the Gemini API with a Google AI Studio key. Google’s [available regions](https://ai.google.dev/gemini-api/docs/available-regions) list does not include Hong Kong or Mainland China. The Gemini app on the web or on a phone can be open in Hong Kong while this API still refuses the call.

The page looks up this machine’s public IP. If that place is Mainland China or Hong Kong, Generate stays off and the page shows: “The LLM is not available in your current region.” A VM in `asia-east2` (Hong Kong) does the same, because the lookup uses the VM’s address.

For this job — keep one face, follow a dress direction, and use up to three reference images — the image model offered in Hong Kong is Qwen-Image on Alibaba Cloud Model Studio, Hong Kong region (`qwen-image-3.0`, or the current Qwen image-edit model). That endpoint accepts reference images for editing. This project does not call it. Seedream and Flux can also generate clothes, and they are also not wired in here.

## Deploy on a Google Cloud VM

Use this when you want the existing Gemini build on Compute Engine. Pick a region Google lists for the Gemini API. Nearby choices are Taiwan (`asia-east1`), Singapore (`asia-southeast1`), and Tokyo (`asia-northeast1`). Do not use Hong Kong (`asia-east2`).

A small Ubuntu VM is enough. An `e2-small` with a 10 GB disk can run the page. Image generation happens at Google, not on the VM.

Leave port 3000 closed. Reach the page through an SSH tunnel, as below. The login stops a stranger who can open the port, and the tunnel keeps the port off the public internet.

### 1. Create the VM

In the Cloud console, or with the gcloud CLI, create an Ubuntu VM in one of the regions above. Do not add a firewall rule for port 3000. The default SSH rule is enough.

### 2. Install Node.js 20 and git

SSH into the VM, then:

```bash
sudo apt-get update
sudo apt-get install -y git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
git --version
```

### 3. The GitHub repository

This app sits inside the MiniProjects repository: `https://github.com/kyalan/MiniProjects.git`, in the folder `20260926_FashionFitter`. Do not run `git init` inside this app folder.

`.env.local` is listed in `.gitignore`. It is not in the repository. The Gemini key and the sign-in password stay on each machine.

### 4. Clone it on the VM and start it

On the VM:

```bash
sudo mkdir -p /opt/mini-projects
sudo chown "$USER" /opt/mini-projects
git clone https://github.com/kyalan/MiniProjects.git /opt/mini-projects
cd /opt/mini-projects/20260926_FashionFitter
npm install
printf '%s\n' \
  'GEMINI_API_KEY=your-key-here' \
  'APP_LOGIN_ID=your-id' \
  'APP_LOGIN_PASSWORD=your-password' \
  > .env.local
chmod 600 .env.local
```

`.env.local` stays on the VM. Do not commit it. The GitHub repository is public or private according to how you set `kyalan/MiniProjects`. If it is private, the VM needs a way to read it: `gh auth login`, an SSH key added to GitHub, or a personal access token used as the clone password.

Check it once in the foreground:

```bash
npm start
```

`npm start` builds the page, then serves it on port 3000 inside the VM. Session files are written to `data/sessions` on that disk. Stop it with Ctrl+C after you see the listening line.

### 5. Keep it running

Add a systemd service. Create `/etc/systemd/system/fashion-fitter.service`:

```ini
[Unit]
Description=Fashion Fitting Studio
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/mini-projects/20260926_FashionFitter
ExecStart=/usr/bin/npm start
Restart=on-failure
User=YOUR_USER

[Install]
WantedBy=multi-user.target
```

Replace `YOUR_USER` with the account that owns `/opt/mini-projects`.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now fashion-fitter
sudo systemctl status fashion-fitter
```

`npm start` builds on every restart. That is the intended production command.

### 6. Open the page from your computer

From your own computer, not from the VM:

```bash
gcloud compute ssh VM_NAME --zone=ZONE -- -L 3000:127.0.0.1:3000
```

Leave that session open and visit http://127.0.0.1:3000. Sign in with the ID and password from the VM's `.env.local`. The tunnel ends when you close the SSH session.

The connection line on the page is the VM’s public location, not the city you are sitting in. The fitting place follows the City dropdown. It starts as the East Asian city that matches the VM.

### 7. Update the VM after you change the code

On your computer, from the `MiniProjects` folder:

```bash
git add 20260926_FashionFitter
git commit -m "Describe what changed"
git push origin main
```

On the VM:

```bash
cd /opt/mini-projects
git pull
cd 20260926_FashionFitter
npm install
sudo systemctl restart fashion-fitter
```

`git pull` updates the code. `npm install` picks up any new packages. The restart rebuilds the page and serves it. `.env.local` on the VM is left as it is, because that file is not in git. Session files in `data/sessions` are also left in place.

If `git pull` says your local VM changes would be overwritten, do not edit the app on the VM. Change it on your computer, push, and pull again.
