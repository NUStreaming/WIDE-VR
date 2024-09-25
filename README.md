# VV Streaming for the Web (vvs-for-web)

## Download datasets

- `assets/vsenseVVDB2`
    - Download link: https://drive.google.com/file/d/1COQNALBO8irgtM2WoeH_evDi32_di0Kf/view?usp=sharing
    - Add dataset to: `Babylon.js/master/assets/vsenseVVDB2/Matis_obj_Draco-Jpeg`

- `assets/museum` and `assets/objects`
    - See original repository: https://github.com/Plateforme-VR-ENISE/AdaptiveStreaming


## To build

```bash
cd Babylon.js/master
npm install
```

## To run

```bash
# For Babylon.js player
cd Babylon.js/masterVMesh
npm run start

# For WebTransport server
cd webtransport-go/src
go run main.go

# For dev Chrome browser
cd scripts
bash start-localhost-test-chrome-linux.sh
# Navigate to: https://localhost:8080/ -> Click on "Advanced" and "Proceed to site"

```

## Potential issues

- In Firefox, if you get cert/quic error (e.g. "Cross-Origin Request Blocked") when retrieving the media segments from Nginx server, open another tab and head to `https://localhost:8443`, then click "Advanced" and accept the cert from this host.

