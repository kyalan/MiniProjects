# Cosplay Fitter

A local cosplay page. You add a face photo, choose an ACG topic and character, and ask for up to five previews. The page prices the Gemini call before you generate, then saves the photo, the prompts, and the previews under `data/sessions`. The API key is not saved.

Character portraits are loaded from the Jikan API and cached under `data/acg-cache`. That cache is not committed. If a portrait cannot be loaded, the card shows the character's name and the prompt uses the written costume brief only.

One Node process serves the page and the API. It uses Gemini 3.1 Flash Image only.

## Run it on this computer

You need Node.js 20 or newer.

```bash
npm install
```

Copy `.env.example` to `.env.local` and set your key, your sign-in ID, and your password:

```bash
GEMINI_API_KEY=
APP_USER=
APP_PASSWORD=
```

`APP_USER` is the ID you type on the sign-in page. `APP_PASSWORD` is the password. Pick both yourself. They are not built into the app, and `.env.local` is not committed. Restart the process after you change them. Until both are set, the sign-in page stays up and tells you to add them.

You can leave the Gemini key blank and paste it into the page instead. Either way, the key is sent only to this process and then to Google. It is not written into `data/sessions`.

```bash
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Sign in with the ID and password from `.env.local`. The process listens on this computer only.

`npm test` runs the tests. `npm start` builds the page and serves that build.

## Gemini is not available in Hong Kong

This studio calls the Gemini API with a Google AI Studio key. Google’s [available regions](https://ai.google.dev/gemini-api/docs/available-regions) list does not include Hong Kong or Mainland China. The Gemini app on the web or on a phone can be open in Hong Kong while this API still refuses the call.

The page looks up this machine’s public IP and compares that country with Google’s current [available regions](https://ai.google.dev/gemini-api/docs/available-regions). The Hong Kong weather line is not part of that check. If the looked-up country is missing from the list, including Mainland China and Hong Kong, Generate stays off and the page names that looked-up place. A VM in `asia-east2` (Hong Kong) does the same, because the lookup uses the VM’s address.

For this job — keep one face and follow a character costume — the image model offered in Hong Kong is Qwen-Image on Alibaba Cloud Model Studio, Hong Kong region (`qwen-image-3.0`, or the current Qwen image-edit model). That endpoint accepts reference images for editing. This project does not call it. Seedream and Flux can also generate clothes, and they are also not wired in here.

## Push it to GitHub

This folder is the `20261001_CosplayFitter` project inside [kyalan/MiniProjects](https://github.com/kyalan/MiniProjects). Push from the MiniProjects checkout, not from a new repository created only for this folder. Do not commit `.env.local`. Check `git status` and confirm that file is absent before you commit.

```bash
cd ..
git remote -v
git add 20261001_CosplayFitter
git status
git commit -m "Add Cosplay Fitter"
git push origin HEAD
```

`git remote -v` should show `https://github.com/kyalan/MiniProjects.git`. If `origin` is missing, add it once:

```bash
git remote add origin https://github.com/kyalan/MiniProjects.git
git push -u origin HEAD
```

## Deploy on a Google Cloud VM

Use this when you want the existing Gemini build on Compute Engine. Pick a region Google lists for the Gemini API. Nearby choices are Taiwan (`asia-east1`), Singapore (`asia-southeast1`), and Tokyo (`asia-northeast1`). Do not use Hong Kong (`asia-east2`).

A small Ubuntu VM is enough. An `e2-small` with a 10 GB disk can run the page. Image generation happens at Google, not on the VM.

Sign-in is required, and it is not a substitute for keeping the port closed. Leave port 3000 closed. Reach the page through an SSH tunnel, as below. A public address could spend the API key.

### 1. Create the VM

In the Cloud console, or with the gcloud CLI, create an Ubuntu VM in one of the regions above. Do not add a firewall rule for port 3000. The default SSH rule is enough.

### 2. Install Git and Node.js 20

A new Ubuntu VM does not include Git. SSH into the VM, then:

```bash
sudo apt-get update
sudo apt-get install -y git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
git --version
node -v
```

### 3. Copy the project and start it

Clone [kyalan/MiniProjects](https://github.com/kyalan/MiniProjects) onto the VM, then work in the Cosplay Fitter folder.

```bash
sudo mkdir -p /opt/miniprojects
sudo chown "$USER" /opt/miniprojects
git clone https://github.com/kyalan/MiniProjects.git /opt/miniprojects
cd /opt/miniprojects/20261001_CosplayFitter
npm install
cat > .env.local << 'EOF'
GEMINI_API_KEY=your-key-here
APP_USER=the-id-you-will-type
APP_PASSWORD=a-long-password-you-choose
EOF
chmod 600 .env.local
```

`.env.local` stays on the VM. Do not commit it. `APP_USER` and `APP_PASSWORD` are the sign-in ID and password. Use the same pair you set on your own computer, or a different pair that exists only on the VM.

Check it once in the foreground:

```bash
npm start
```

`npm start` builds the page, then serves it on `127.0.0.1:3000` inside the VM. Session files are written to `data/sessions` on that disk.

### 4. Keep it running

Stop the foreground process with Ctrl-C. Install tmux if this VM does not have it, then start the page inside a session named `cosplay-fitter`:

```bash
sudo apt-get install -y tmux
cd /opt/miniprojects/20261001_CosplayFitter
tmux new -s cosplay-fitter
npm start
```

`npm start` builds the page, then serves it. Leave that session with Ctrl-b, then d. Closing the SSH connection does not stop the session.

Open the session again with:

```bash
tmux attach -t cosplay-fitter
```

After the VM reboots, the session is gone. SSH in and run `tmux new -s cosplay-fitter` and `npm start` again.

### 5. Open the page from your computer

From your own computer, not from the VM:

```bash
gcloud compute ssh VM_NAME --zone=ZONE -- -L 3000:127.0.0.1:3000
```

Leave that session open and visit [http://127.0.0.1:3000](http://127.0.0.1:3000). Sign in with the ID and password from the VM's `.env.local`. The tunnel ends when you close the SSH session.

To update the VM after a later GitHub push, attach the session, stop the page with Ctrl-C, then start it again:

```bash
cd /opt/miniprojects
git pull
tmux attach -t cosplay-fitter
```

Inside the session:

```bash
npm start
```

Leave the session again with Ctrl-b, then d.

The place line is always Hong Kong. Date and temperature in the outfit prompts follow Hong Kong weather from the web, not the city you are sitting in and not the VM’s public location. Whether Gemini is available is a separate lookup of this machine’s public IP against Google’s current available regions.