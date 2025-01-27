import ObjectManager from "./object_manager";
// import RouteManager from "./route_manager";
import CameraManager from "./camera_manager";
import Utils from "./game_utils";
import StatsLogger from "./stats_logger";
import { Mesh, Scene, Geometry, Vector3, Tools, Engine } from "@babylonjs/core";
import { FreeCamera, AbstractMesh } from "@babylonjs/core";
import { Observable, Observer, RawTexture } from "babylonjs";


export default class PlaybackManager {
    private objectManager: ObjectManager;
    // private routeManager: RouteManager;
    private cameraManager: CameraManager;
    private utils: Utils;
    private scene: Scene;
    private engine: Engine;
    private meshes: Array<Mesh> = [];

    // private isPlaybackLoopRunning: boolean = false;
    private playbackLoopObservable: Observer<Scene>|null = null;
    private prevFrameUpdateTime: number = 0;

    private isStalling: boolean = false;
    private startStallTime: number = 0;

    public hasPlaybackStarted: boolean = false;
    public hasPlaybackStartedAfterStartupDelay: boolean = false;
    public startPlaybackTime: number|null = null;
    public endPlaybackTime: number|null = null;


    public nextFrameNoForPlayback: number = 1;
    public lastFrameNo: number|null = null;
 
    private minBufferForStartup: number;
    private minBufferForResume: number;

    constructor(utils: Utils, objectManager: ObjectManager, cameraManager: CameraManager) {
        this.objectManager = objectManager;
        this.cameraManager = cameraManager;
        this.scene = utils.scene;
        this.engine = utils.engine;
        this.utils = utils;

        this.minBufferForStartup = this.utils.minBufferForStartupInSec;
        this.minBufferForResume = this.utils.minBufferForStartupInSec;
    }


    /*
     * Do these stuff when starting playback loop for the first time
     */
    public beginPlayback = () => {
        // Get/set some parameters
        this.hasPlaybackStarted = true;
        this.startPlaybackTime = performance.now();
        const totalFrameCounts = this.objectManager.getAllObjects().map(dMeshObject => dMeshObject.getNumberOfFrames());
        this.lastFrameNo  = Math.min(...totalFrameCounts);

        // Hide init meshes
        for (const obj of this.objectManager.getAllObjects()) {
            obj.getLevel(3)?.setEnabled(false);
        }

        // Hide the play button
        const playBtn = document.getElementById(
            "overlayPlayBtn",
            ) as HTMLDivElement | null;
        if (playBtn) playBtn.style.display = "none";

        // this.objectManager.initialSceneMeshesLen = this.utils.scene.meshes.length;

        this.playbackLoopObservable = this.scene.onBeforeRenderObservable.add(() => {
            // Check if interval time has passed
            // (ref: https://forum.babylonjs.com/t/how-can-i-set-a-custom-fps/10462/3)
            const currTime = performance.now();
            const deltaTime = currTime - this.prevFrameUpdateTime;
            const nextFrameInterval = 1000/this.utils.targetPlaybackFps;

            if (deltaTime >= nextFrameInterval) {
                // console.log('Pass: Frame interval check')
                this.prevFrameUpdateTime = currTime - (deltaTime % nextFrameInterval);

                if (this.isStalling && !this.isBufferSufficientForPlayback()) {
                    console.log('Fail min buffer check, skipping playback loop..')
                    return
                }

                if (this.isStalling) {
                    this.unstallPlayer();
                }
                
                // Update scene with next mesh frame
                console.log('------------------- UpdateScene(), nextFrameNoForPlayback: ' + this.nextFrameNoForPlayback)
                for (const obj of this.objectManager.getAllObjects()) {

                    var frameId = String(this.nextFrameNoForPlayback).padStart(5, '0')
                    const segment = obj.getBufferAt(this.nextFrameNoForPlayback - 1);

                    
                    // Update value on UI for debugging
                    const segmentIdTxt = document.getElementById(
                        "segmentIdTxt",
                    ) as HTMLDivElement | null;
                    if (segmentIdTxt) segmentIdTxt.innerHTML = String(frameId);

    
                    // Stall player if no segment found in buffer
                    if (!segment) {
                        console.log(`No segment found for frame ${this.nextFrameNoForPlayback}.. Stalling player and stopping playback loop..`);
                        this.stallPlayer();

                        // clearInterval(playbackLoopHandler);
                        // this.isPlaybackLoopRunning = false;
                        
                        return;
                    }

    
                    // Apply geometry
                    const mesh = new Mesh("dracoMesh" + frameId, this.scene);
                    mesh.cullingStrategy = AbstractMesh.CULLINGSTRATEGY_OPTIMISTIC_INCLUSION_THEN_BSPHERE_ONLY; // Try speeding up
                    
                    const geometry = new Geometry("dracoGeometry" + frameId, this.scene, segment.decodedGeometryData);
                    geometry.applyToMesh(mesh);
                    segment.decodedGeometryData = undefined;    // Clear data to free up memory
    
                    // Apply texture
                    if (this.utils.includeTexture) {
                        mesh.material = segment.textureData;
                    }
    
                    mesh.position = obj.getPosition();
                    mesh.rotation = obj.getRotation();
                    mesh.scaling = obj.getScale();
                    mesh.receiveShadows = true;
                    mesh.refreshBoundingInfo();
    
    
                    // Hide previously loaded mesh
                    for (var i = this.meshes.length - 1; i >= 0; i--) {
                    // for (var i = this.meshes.length - 1 - (this.objectManager.getAllObjects().length); i >= 0; i--) {
                        if (this.meshes[i].position == obj.getPosition()) {
                            obj.currentMesh = this.meshes[i];   // Save t-1 mesh for evaluation of visibility (using the next mesh will not work as it has not been rendered yet)
                            this.meshes[i].dispose(true, true);
                            break;  // The loop will break after the intended obj's mesh is disposed
                        }
                    }

                    this.meshes.push(mesh);

                    // Update stats
                    StatsLogger.logStatsBySegmentOnPlayback(obj, segment);
                }


                // In order to make predictions, 
                //  we have te save the position and rotation after updating
                this.cameraManager.saveCameraPosition();


                // Capture screenshots for post-processing e.g. of perceptual quality
                if (this.utils.captureScreenshot && this.cameraManager.getCamera() && (Number(this.nextFrameNoForPlayback) % this.utils.captureScreenshotInterval == 0)) {
                // if (this.utils.captureScreenshot && this.cameraManager.getCamera() && Number(this.nextFrameNoForPlayback) < 100) {
                    Tools.CreateScreenshot(this.engine, this.cameraManager.getCamera(), { precision: 1 }, (data) => {
                        console.log('Screenshot captured..');
                        StatsLogger.logScreenshotCaptured(`Frame_${(this.nextFrameNoForPlayback-1).toString().padStart(5, '0')}`, data);
                    });
                }
    
                if (this.nextFrameNoForPlayback == 2) {  // We do not check at frame_1 because there is a delay between processing it and rendering it
                    this.hasPlaybackStartedAfterStartupDelay = true;
                }

                this.nextFrameNoForPlayback++;
    
                // End playback 
                if (this.lastFrameNo && this.nextFrameNoForPlayback == (this.lastFrameNo + 1)) {
                    this.stopPlayback();
                    
                }
                
            }
        });
    }

    /*
     * Do these stuff to stop playback
     */
    public stopPlayback = () => {
        console.log('Stop playback..');
        this.endPlaybackTime = performance.now();
        this.scene.onBeforeRenderObservable.remove(this.playbackLoopObservable);

        console.log('Saving stats from playback session..');
        StatsLogger.saveSessionStats();

        // Display playback ended
        const loadingDiv = document.getElementById(
            "overlayLoadingDiv",
        ) as HTMLDivElement | null;
        if (loadingDiv) loadingDiv.style.display = "block";

        const loadingTxt = document.getElementById(
            "overlayLoadingTxt",
        ) as HTMLDivElement | null;
        if (loadingTxt) loadingTxt.innerHTML = "Playback Ended";

        window.dispatchEvent(new Event("playbackStop"));

        return;
    }


    public isBufferSufficientForPlayback = (): boolean => {
        const minBufferLengthInFrameCount = this.getMinBufferLengthAcrossObjectsInFrameCount();

        // Edge case for playback is when the buffer is at the end of the stream (then we ignore whatever (possibly missed) requirement below)
        if (this.lastFrameNo && minBufferLengthInFrameCount == this.lastFrameNo)
            return true;

        // Less than required startup buffer
        if (minBufferLengthInFrameCount < (this.minBufferForStartup * this.utils.targetPlaybackFps))
            return false;
        // More than or equal to required startup buffer but less than required resume buffer
        else if (minBufferLengthInFrameCount < (this.nextFrameNoForPlayback + (this.minBufferForResume * this.utils.targetPlaybackFps)))
            return false;
        else
            return true;
    }

    public getMinBufferLengthAcrossObjectsInFrameCount = (): number => {
        const bufferLengths = this.objectManager.getAllObjects().map(dMeshObject => dMeshObject.getBufferSize());
        const minBufferLength = Math.min(...bufferLengths);
        
        //For future: Loop to find min based on loaded texture?

        return minBufferLength;
    }

    public getCurrentBufferInSeconds = (): number => {
        let currentBufferInFrames = this.getMinBufferLengthAcrossObjectsInFrameCount() - this.nextFrameNoForPlayback;
        return currentBufferInFrames / this.utils.targetPlaybackFps;
    }

    public getMinBufferForStartup = (): number => {
        return this.minBufferForStartup;
    }

    public getMinBufferForResume = (): number => {
        return this.minBufferForResume;
    }

    public getCurrentPlaybackTime = (): number => {
        return (this.nextFrameNoForPlayback-1) / this.utils.targetPlaybackFps;
    }


    private stallPlayer = () => {
        if (this.isStalling) {
            return;
        }

        this.isStalling = true;
        this.startStallTime = performance.now();
        console.log('Begin stall...');

        // Show stalling
        const loadingDiv = document.getElementById(
            "overlayLoadingDiv",
          ) as HTMLDivElement | null;
        if (loadingDiv) loadingDiv.style.display = "block";
        // this.engine.displayLoadingUI();
    }

    private unstallPlayer = () => {
        this.isStalling = false;
        const stallDuration = performance.now() - this.startStallTime;  // in ms

        if (StatsLogger.startupDelay == 0) {
            StatsLogger.startupDelay += stallDuration;
        } else {
            StatsLogger.cumulativeStall += stallDuration;
            StatsLogger.numStalls++;
        }
        console.log(`End stall... stallDuration: ${stallDuration}`);

        // Hide stalling
        const loadingDiv = document.getElementById(
            "overlayLoadingDiv",
          ) as HTMLDivElement | null;
        if (loadingDiv) loadingDiv.style.display = "none";
        // this.engine.hideLoadingUI();
    }

    public isPlayerStalling = (): boolean => {
        return this.isStalling;
    }

    public isPlaybackEnded = (): boolean => {
        return this.endPlaybackTime != null;
    }
}