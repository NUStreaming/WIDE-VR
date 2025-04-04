# WIDE-VR: Web-based Immersive Delivery Engine for VR applications

Code base for paper (under review): "WIDE-VR: An open-source prototype for web-based VR through adaptive streaming of 6DoF content and viewport prediction" (authors: May Lim \<maylim@comp.nus.edu.sg\>, Abdelhak Bentaleb \<abdelhak.bentaleb@concordia.ca\>, Roger Zimmermann \<rogerz@comp.nus.edu.sg\>)

## Setup

### Download dataset

- Pre-encoded meshes are obtained from V-SENSE Volumetric Video Quality Database #2 (vsenseVVDB2) 
    - Download link: https://v-sense.scss.tcd.ie/research/vsensevvdb2-v-sense-volumetric-video-quality-database-2/
    - Add meshes to folder: `server/nginx/static/media/vsenseVVDB2`
    - Preview of directory setup:
    <img src="./docs/media-dir-1.png" width="500">
    <img src="./docs/media-dir-2.png" width="500">

### Set up certificate

```bash
cd server/nginx/config/certs
vi req.cnf
sudo openssl req -x509 -nodes -days 730 -newkey rsa:2048 \
 -keyout cert-localhost.key -out cert-localhost.pem -config req.cnf -sha256
```
- Ensure that files `cert-localhost.key` and `cert-localhost.pem` are added to folder `server/nginx/config/certs`


## To Build

### Babylon.js player
```bash
cd client/Babylon.js
npm install
```

### Automated testing on puppeteer (optional)
```bash
cd test/puppeteer
npm install
```


## To Run

### Babylon.js player

- Update the player's IP address in `client/Babylon.js/webpack.config-dev.js`
- Update the media server's IP address in `client/Babylon.js/src/game_utils.ts`

```bash
cd client/Babylon.js
npm run start
```

### Nginx server

- Update the config files in folder `server/nginx/config` with your system path
- There are three config files for the different HTTP versions

```bash
sudo nginx -c <path_to_project>/WIDE-VR/server/nginx/config/nginx_h2.conf
```

### Automated testing on puppeteer (optional)

- Update the player's IP address in `test/puppeteer/run.js`
```bash
cd test/puppeteer
npm run test
```


## Project Directory Structure

```
WIDE-VR
│  README.md
│  ...  
│
└─ client/Babylon.js          # Web-based player
|  |  webpack.config-dev.js   # Webpack config params
|  |  ...
│  │
│  └─ src                     # Source files
|     |  game_utils.ts        # Player config params
│     │  ...
│   
└─ server/nginx   # Media server
│  │  config      # Config files for different HTTP versions
|  |  static      # To add mesh objects of varying quality levels
│  |  ...  
│  
└─ test/puppeteer             # Automated testing with puppeteer
   |  run.js
   |  ...
```


## System Interactions

![alt text](https://github.com/NUStreaming/WIDE-VR/blob/main/docs/sequence-diagram.png?raw=true)

## Potential Issues

- If you get "Unable to load" (from media server) errors or "Cross-Origin Request Blocked" errors, open another tab and head to `https://<server_ip>:8443`, then click "Advanced" and accept the cert from this host.

- If Chrome is unable to run quic, re-run the application with the following params (note placeholders): `/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --enable-quic --allow-insecure-localhost --origin-to-force-quic-on=127.0.0.1:8443,<alternative_ip_address>:8443 --ignore-certificate-errors  --user-data-dir=/tmp/temp-chrome --ignore-certificate-errors-spki-list="<generate_spki_from_your_cert>"`
