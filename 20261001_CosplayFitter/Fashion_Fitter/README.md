# Fashion Fitting Studio

A local fitting page. You add a face photo or an illustrated character, a dress code, and up to five previews. The page prices the Gemini call before you generate, then saves the photo, the prompts, and the previews under `data/sessions`. The API key is not saved.

One Node process serves the page and the API. It uses Gemini 3.1 Flash Image only.

## Run it on this computer

You need Node.js 20 or newer.

```bash
npm install
```

Copy `.env.example` to `.env.local` and set your key:

```bash
GEMINI_API_KEY=
```

You can leave that blank and paste the key into the page instead. Either way, the key is sent only to this process and then to Google. It is not written into `data/sessions`.

```bash
npm run dev
```

Open http://127.0.0.1:3000. The process listens on this computer only.

`npm test` runs the tests. `npm start` builds the page and serves that build.

## Gemini is not available in Hong Kong

This studio calls the Gemini API with a Google AI Studio key. Google’s [available regions](https://ai.google.dev/gemini-api/docs/available-regions) list does not include Hong Kong or Mainland China. The Gemini app on the web or on a phone can be open in Hong Kong while this API still refuses the call.

The page looks up this machine’s public IP. If that place is Mainland China or Hong Kong, Generate stays off and the page shows: “The LLM is not available in your current region.” A VM in `asia-east2` (Hong Kong) does the same, because the lookup uses the VM’s address.

For this job — keep one face, follow a dress direction, and use up to three reference images — the image model offered in Hong Kong is Qwen-Image on Alibaba Cloud Model Studio, Hong Kong region (`qwen-image-3.0`, or the current Qwen image-edit model). That endpoint accepts reference images for editing. This project does not call it. Seedream and Flux can also generate clothes, and they are also not wired in here.

## Deploy on a Google Cloud VM

Use this when you want the existing Gemini build on Compute Engine. Pick a region Google lists for the Gemini API. Nearby choices are Taiwan (`asia-east1`), Singapore (`asia-southeast1`), and Tokyo (`asia-northeast1`). Do not use Hong Kong (`asia-east2`).

A small Ubuntu VM is enough. An `e2-small` with a 10 GB disk can run the page. Image generation happens at Google, not on the VM.

The page has no login. Leave port 3000 closed. Reach it through an SSH tunnel, as below. A public address could spend the API key.

### 1. Create the VM

In the Cloud console, or with the gcloud CLI, create an Ubuntu VM in one of the regions above. Do not add a firewall rule for port 3000. The default SSH rule is enough.

### 2. Install Node.js 20

SSH into the VM, then:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
```

### 3. Copy the project and start it

Copy this folder onto the VM, for example with `gcloud compute scp` or `git clone`. The steps below use `/opt/fashion-fitter`.

```bash
sudo mkdir -p /opt/fashion-fitter
sudo chown "$USER" /opt/fashion-fitter
# copy the project files into /opt/fashion-fitter, then:
cd /opt/fashion-fitter
npm install
printf 'GEMINI_API_KEY=your-key-here\n' > .env.local
chmod 600 .env.local
```

`.env.local` stays on the VM. Do not commit it.

Check it once in the foreground:

```bash
npm start
```

`npm start` builds the page, then serves it on `127.0.0.1:3000` inside the VM. Session files are written to `data/sessions` on that disk.

### 4. Keep it running

Stop the foreground process, then add a systemd service. Create `/etc/systemd/system/fashion-fitter.service`:

```ini
[Unit]
Description=Fashion Fitting Studio
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/fashion-fitter
ExecStart=/usr/bin/npm start
Restart=on-failure
User=YOUR_USER

[Install]
WantedBy=multi-user.target
```

Replace `YOUR_USER` with the account that owns `/opt/fashion-fitter`.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now fashion-fitter
sudo systemctl status fashion-fitter
```

`npm start` builds on every restart. That is the intended production command.

### 5. Open the page from your computer

From your own computer, not from the VM:

```bash
gcloud compute ssh VM_NAME --zone=ZONE -- -L 3000:127.0.0.1:3000
```

Leave that session open and visit http://127.0.0.1:3000. The tunnel ends when you close the SSH session.

The place line on the page is the VM’s public location, not the city you are sitting in. Date and temperature in the outfit prompts follow that VM location.
