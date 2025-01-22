import {PBRMaterial, Texture, Tools} from "@babylonjs/core";
import DMeshSegment from "./dmesh_segment";
import BufferManager from "./buffer_manager";
import ObjectManager from "./object_manager";
import AbrManager from "./abr_manager";
import DMeshObject from "./dmesh_object";
import SpeedManager from "./speed_manager";
import CameraManager from "./camera_manager";
import PlaybackManager from "./playback_manager";
import Utils from "./game_utils";
import StatsLogger from "./stats_logger";


export default class DownloadManager {
    private objectManager: ObjectManager;
    private bufferManager: BufferManager;
    private abrManager: AbrManager;
    private cameraManager: CameraManager;
    private playbackManager: PlaybackManager;
    private utils: Utils;

    // private fps: number = 15;
    // private frameNo: number = 1;
    private segmentNo: number = 1;
    private totalBandwidthInParallel: number = 0;

    public constructor(utils: Utils, bufferManager: BufferManager, objectManager: ObjectManager, abrManager: AbrManager, cameraManager: CameraManager, playbackManager: PlaybackManager) {
        this.bufferManager = bufferManager;
        this.objectManager = objectManager;
        this.abrManager = abrManager;
        this.cameraManager = cameraManager;
        this.playbackManager = playbackManager;
        this.utils = utils;

        // this.initWebTransportSession();
    }


    public beginSegmentRetrieval = () => {
        this.retrieveNextSegmentForAllObjs();
    }
    

    public retrieveNextSegmentForAllObjs = async () => {
        // To add delay between downloads for debugging
        // const delayMs = 2000;
        // await new Promise(res => setTimeout(res, delayMs));

        const downloadPromises = [];

        // Obtain LoD for next segment via chosen ABR strategy
        const objectLevels = await this.abrManager.getQualityLevelsByChosenStrategy(this.segmentNo);
        
        console.log(`>> Begin downloading segment ${this.segmentNo} for all objects..`);
        for (let i = 0; i < objectLevels.length; i++) {
            // const geometryQuality = objectLevels[i].nextLevel;
            // const textureQuality = objectLevels[i].nextLevel;
            // const object = objectLevels[i].object;

            downloadPromises.push(this.downloadObjectFromServer(objectLevels[i], this.segmentNo));
        }
        
        Promise.all(downloadPromises).then(() => {
            console.log(`>> Done downloading segment ${this.segmentNo} for all objects!`);
            console.log(`-- totalBandwidthInParallel (mbps): ${this.totalBandwidthInParallel*8/1000}`);
            if ((this.totalBandwidthInParallel*8/1000) >= 500) {
                console.log("$$$$$$$ ALERT $$$$$$$")
            }

            SpeedManager.pushBandwidth(this.totalBandwidthInParallel);
            this.totalBandwidthInParallel = 0;

            this.segmentNo++;  // To retrieve all frames
            // this.segmentNo += Math.floor(30 / this.playbackManager.targetPlaybackFps);  // To retrieve frames according to playbackFps
            
            if (this.playbackManager.lastFrameNo && this.segmentNo > this.playbackManager.lastFrameNo) {
                console.log('Done downloading all segments!');
            } else {
                this.retrieveNextSegmentForAllObjs();   // Initiates download of next segment after current segment is done downloading
            }

        }).catch((err) => {
            console.log(`Error downloading segment ${this.segmentNo}: ${err}`);
        });
    }


    public downloadObjectFromServer = async (objectToRetrieve: { object: DMeshObject, utility: number, level: number }, frameNo: number) => {
        const geometryQuality = objectToRetrieve.level;
        const textureQuality = objectToRetrieve.level;
        // const geometryQuality = 3;  // testing
        // const textureQuality = 3;   // testing
        const dMeshObject = objectToRetrieve.object;

        if (dMeshObject.getFolderPath().includes('AxeGuy')) {
            frameNo += 50;
        }

        const scene = dMeshObject.scene
        const frameId = String(frameNo).padStart(5,'0');

        // Download geometry
        const geometryFoldername = dMeshObject.getFolderPath().replace('./', '');
        const geometryFilename = dMeshObject.getMetadata().Levels[geometryQuality].filename.replace(/Frame_[0-9]+/i, `Frame_${frameId}`);
        // const geometryResUrl = `https://${this.utils.serverIp}:8443/${geometryFoldername}${geometryFilename}`.replace('assets','static/media');
        const geometryResUrl = `${geometryFoldername}${geometryFilename}`;

        const startrequest = performance.now(); // Time before requesting the LoD
        const geometryData: ArrayBuffer = <ArrayBuffer> await Tools.LoadFileAsync(geometryResUrl);
        const endrequest = performance.now(); // Time after recieving the Draco file
        
        const timeTakenAdjustment = 0.95;  // To discount add'l processing time within the Tools lib (param determined by comparing time taken measurements against Chrome's network tab)
        const bandwidthKBps = geometryData.byteLength / ((endrequest - startrequest) * timeTakenAdjustment);
        console.log(`  .. geometryResUrl: ${geometryResUrl}`)
        console.log(`  .. geometryQuality: ${geometryQuality}`)
        console.log(`  .. size: ${geometryData.byteLength}`)
        console.log(`  .. time taken for download: ${(endrequest - startrequest)}`)
        console.log(`  .. bandwidthKBps: ${bandwidthKBps}`)
        this.totalBandwidthInParallel += bandwidthKBps;

        // Update value on UI for debugging
        const downloadDebugTxt = document.getElementById(
            "downloadDebugTxt",
        ) as HTMLDivElement | null;
        if (downloadDebugTxt) downloadDebugTxt.innerHTML = String((endrequest - startrequest).toFixed(2));

        const downloadSpeedTxt = document.getElementById(
            "downloadSpeedTxt",
        ) as HTMLDivElement | null;
        if (downloadSpeedTxt) downloadSpeedTxt.innerHTML = String((bandwidthKBps*8/1000).toFixed(2));

        // Download texture
        const material = new PBRMaterial(`Material${frameId}`, scene);
        let textureFoldername = "";
        let textureFilename = "";
        let textureResUrl = "";
        let textureWidth = 0;
        let textureHeight = 0;

        let rawTextureData: ArrayBuffer | null = null;
        
        if (this.utils.includeTexture) {
            textureFoldername = dMeshObject.getFolderPath().replace('./', '');
            textureFilename = dMeshObject.getMetadata().Textures[textureQuality].filename.replace(/Frame_[0-9]+/i, `Frame_${frameId}`);
            // textureResUrl = `https://${this.utils.serverIp}:8443/${textureFoldername}${textureFilename}`.replace('assets','static/media');
            textureResUrl = `${textureFoldername}${textureFilename}`;
            
            // console.log(`### frameNo: ${frameNo} /1/ ${performance.now()}`)
            const texture = new Texture(textureResUrl, scene);
            // texture.onLoadObservable.add(() => {
            //     console.log(`### frameNo: ${frameNo} /onLoadTexture/ ${performance.now()}`)
            // })
            // console.log(`### frameNo: ${frameNo} /2/ ${performance.now()}`)

            material.backFaceCulling = false;
            material.albedoTexture = texture;
            // console.log(`### frameNo: ${frameNo} /3/ ${performance.now()}`)
            material.metallicTexture = texture;
            // console.log(`### frameNo: ${frameNo} /4/ ${performance.now()}`)
            material.roughness = 1;
            material.metallic = 0.3;
            material.freeze();  // Try speeding up

            textureWidth = texture.getSize().width;
            textureHeight = texture.getSize().height;

            // // &&&&&&&&&&&&&&&&&&&&&&&&&&&& testing
            // rawTextureData = <ArrayBuffer> await Tools.LoadFileAsync(textureResUrl);
        }

        const dMeshSegment = new DMeshSegment( geometryData, material, rawTextureData );
        dMeshSegment.segmentId = frameId;
        dMeshSegment.utility = objectToRetrieve.utility;
        dMeshSegment.geometryResUrl = geometryResUrl;
        dMeshSegment.textureResUrl = textureResUrl;
        dMeshSegment.geometryQuality = geometryQuality;
        dMeshSegment.textureQuality = textureQuality;
        dMeshSegment.geometrySize = geometryData.byteLength;
        dMeshSegment.textureWidth = textureWidth;
        dMeshSegment.textureHeight = textureHeight;
        
        StatsLogger.logStatsBySegmentOnDownload(dMeshObject, dMeshSegment);
        await this.bufferManager.addSegment(dMeshObject, dMeshSegment);
    }



    
    // private async initWebTransportSession() {
    //     // const url = "https://localhost:4434/wtDownloader";
    //     const url = `https://wsss.deno.dev/`;
    //     const transport = new WebTransport(url);

    //     // Optionally, set up functions to respond to the connection closing:
    //     transport.closed
    //     .then(() => {
    //         console.log(`The HTTP/3 connection to ${url} closed gracefully.`);
    //     })
    //     .catch((error: Error) => {
    //         console.error(`The HTTP/3 connection to ${url} closed due to `, error);
    //     });

    //     // Once .ready fulfilled, the connection can be used
    //     await transport.ready;

    //     // Sending datagrams to the server
    //     const writer = transport.datagrams.writable.getWriter();
    //     const data1 = new Uint8Array([65, 66, 67]);
    //     const data2 = new Uint8Array([68, 69, 70, 71]);
    //     writer.write(data1);
    //     setTimeout(() => {
    //     writer.write(data2);
    //     }, 1e3);

    //     setTimeout(() => {
    //     // close the connection
    //     transport.close({
    //         closeCode: 3000,
    //         reason: "close connection by setTimeout",
    //     });
    //     }, 3e3);

    //     // Read datagrams from the server.
    //     const reader = transport.datagrams.readable.getReader();
    //     while (true) {
    //     const { value, done } = await reader.read();
    //     if (done) {
    //         break;
    //     }
    //     console.log(value);
    //     }





    //     // // Init WebTransport session
    //     // const streamReader = async (stream: any, errorText: any, dataReceivedFunction: any) => {
    //     //     try {
    //     //         let reader = stream.getReader();
    //     //         while (true) {
    //     //         var data = await reader.read();
    //     //         if (data.done) {
    //     //             break;
    //     //         }
    //     //         dataReceivedFunction(data.value);
    //     //         }
    //     //     } catch(error) {
    //     //         console.log(errorText + ':', error);
    //     //     }
    //     // };

    //     // // Text encoder and decoder
    //     // let encoder = new TextEncoder();
    //     // let decoder = new TextDecoder();

    //     // // Connect to WebTransport server
    //     // let transport = new WebTransport("https://localhost:4434/wtDownloader");
    //     // await transport.ready;

    //     // transport.closed
    //     //     .then(() => console.log('Connection closed normally'))
    //     //     .catch(error => console.log('Connection closed abruptly', error));
    // }
}
