# WIDE-VR 

## Download datasets

- `server/nginx/static/media/vsenseVVDB2`
    - Download link: https://drive.google.com/file/d/1COQNALBO8irgtM2WoeH_evDi32_di0Kf/view?usp=sharing
    - Add dataset to: `Babylon.js/master/assets/vsenseVVDB2/Matis_obj_Draco-Jpeg`


## To build

```bash
cd client/Babylon.js
npm install
```

## To run

```bash
# For Babylon.js player
cd client/Babylon.js
npm run start

# For nginx server
# .. do something ..
# cd webtransport-go/src
# go run main.go

# For dev Chrome browser
# .. do something ..
# cd scripts
# bash start-localhost-test-chrome-linux.sh
# Navigate to: https://localhost:8080/ -> Click on "Advanced" and "Proceed to site"

# For puppeteer tests
# .. do something ..

```

## Potential issues

- In Firefox, if you get cert/quic error (e.g. "Cross-Origin Request Blocked") when retrieving the media segments from Nginx server, open another tab and head to `https://localhost:8443`, then click "Advanced" and accept the cert from this host.

