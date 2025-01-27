import { Camera, FreeCamera, Mesh, Scene } from "@babylonjs/core";

import ObjectManager from "./object_manager";
import CameraManager from "./camera_manager";
import DMeshObject from "./dmesh_object";
import Metrics from "./metrics";
import SpeedManager from './speed_manager';
import PlaybackManager from "./playback_manager";
import Utils from "./game_utils";
import StatsLogger from "./stats_logger";
import { StringDictionary } from "babylonjs";


export interface AbrSegmentInput{ 
    objectName: string; 
    segmentId: string; 
    geometryQuality: number; 
    textureQuality: number;
}

export enum StrategyChoice {
    Random_1,
    Greedy_2,
    Uniform_2,
    Bola_1,
    FromFileInput,
    HighestQuality,
    CustomQuality
}

export default class AbrManager {
    private objectManager: ObjectManager;
    private cameraManager: CameraManager;
    private playbackManager: PlaybackManager;
    private utils: Utils;

    private _chosenStrategy: StrategyChoice = StrategyChoice.Random_1; // The strategy we will execute

    // private BUFFER: number = 2; // Download buffer size in seconds
    // private BUFFER: number;
    private SEG_DUR: number;

    private abrFileInput: AbrSegmentInput[] = [];


    public constructor(utils: Utils, objectManager: ObjectManager, cameraManager: CameraManager, playbackManager: PlaybackManager) {
        this.objectManager = objectManager;
        this.cameraManager = cameraManager;
        this.playbackManager = playbackManager;
        this.utils = utils;

        // this.BUFFER = 1/this.playbackManager.targetPlaybackFps * 2.5; // Download buffer size in seconds
        this.SEG_DUR = 1/this.utils.targetPlaybackFps;
    }

    public setStrategy(strategy: StrategyChoice) {
        console.log(strategy + " is being set")
        this._chosenStrategy = strategy;
    }
    
    public getChosenStrategy = (): StrategyChoice => {
        return this._chosenStrategy;
    }
    
    public getChosenStrategyAsString = (): string => {
        return this.getStrategyAsString(this._chosenStrategy);
    }

    public getStrategyAsString = (strategy: StrategyChoice): string => {
        switch(strategy) {
            case StrategyChoice.Random_1:
                return "Random1";
            case StrategyChoice.Greedy_2:
                return "Greedy2";
            case StrategyChoice.Uniform_2:
                return "Uniform2";
            case StrategyChoice.Bola_1:
                return "Bola1";
            case StrategyChoice.FromFileInput:
                return "FromFileInput";
            case StrategyChoice.HighestQuality:
                return "HighestQuality";
            case StrategyChoice.CustomQuality:
                return "CustomQuality";
        }
    }
    
    
    public getQualityLevelsByChosenStrategy = async (segmentNo: number): Promise<Array<{ object: DMeshObject, utility: number, level: number }>> => {
        switch (this._chosenStrategy) {
            case StrategyChoice.Random_1:
                return this.random1();
            case StrategyChoice.Greedy_2:
                return this.greedy2(segmentNo);
            case StrategyChoice.Uniform_2:
                return this.uniform2(segmentNo);
            case StrategyChoice.Bola_1:
                return this.bola1(segmentNo);
            case StrategyChoice.FromFileInput:
                return this.fromfileinput(segmentNo);
            case StrategyChoice.HighestQuality:
                return this.highestQuality();
            case StrategyChoice.CustomQuality:
                return this.customQuality();
        }
    }


    private random1(): Array<{ object: DMeshObject, utility: number, level: number }> {

        // ================ INIT ========================
        const cam: FreeCamera = this.cameraManager.getCamera();
        const objects: DMeshObject[] = this.objectManager.getAllObjects();
        const objectsToRetrieve: Array<{ object: DMeshObject, utility: number, level: number }> = [];  // Stores objs with utility and next quality level as determined by the ABR
        // let newLevel = false;       // Will remain false if we don't select a level

        
        // ================== GETTING THE UTILITY AND SORTING =======================
        for (const obj of objects) {
            const rndInt = Math.floor(Math.random() * 4) + 0;  // Random int between 0 and 3
            objectsToRetrieve.push({ object: obj, utility: -1, level: rndInt });
        };
        
        return objectsToRetrieve;
    }



    private highestQuality(): Array<{ object: DMeshObject, utility: number, level: number }> {

        // ================ INIT ========================
        const cam: FreeCamera = this.cameraManager.getCamera();
        const objects: DMeshObject[] = this.objectManager.getAllObjects();
        const objectsToRetrieve: Array<{ object: DMeshObject, utility: number, level: number }> = [];  // Stores objs with utility and next quality level as determined by the ABR
        // let newLevel = false;       // Will remain false if we don't select a level

        
        // ================== GETTING THE UTILITY AND SORTING =======================
        for (const obj of objects) {
            objectsToRetrieve.push({ object: obj, utility: -1, level: obj.getMetadata().Levels.length - 1 });
        };
        
        return objectsToRetrieve;
    }



    private customQuality(): Array<{ object: DMeshObject, utility: number, level: number }> {

        // ================ INIT ========================
        const cam: FreeCamera = this.cameraManager.getCamera();
        const objects: DMeshObject[] = this.objectManager.getAllObjects();
        const objectsToRetrieve: Array<{ object: DMeshObject, utility: number, level: number }> = [];  // Stores objs with utility and next quality level as determined by the ABR
        // let newLevel = false;       // Will remain false if we don't select a level

        // ================== GETTING THE UTILITY AND SORTING =======================
        for (const obj of objects) {
            let objectName = obj.getMetadata().name;
            let customLevel = 0;
            if (objectName.includes("Matis")) {
                customLevel = 3;
                // customLevel = 2;
                // customLevel = 1;
                // customLevel = 0;
            } else if (objectName.includes("Rafa")) {
                customLevel = 3;
                // customLevel = 2;
                // customLevel = 1;
                // customLevel = 0;
                
            }
            objectsToRetrieve.push({ object: obj, utility: -1, level: customLevel});
        };
        
        return objectsToRetrieve;
    }


    /**
     * Greedy strategy proposed in paper Towards 6DoF HTTP Adaptive Streaming Through Point Cloud Compression
     * For this strategy, we try to allocate the highest level to the object before going to the next on
     */
    private greedy2(segmentNo: number): Array<{ object: DMeshObject, utility: number, level: number }> {
        console.log(`\n---------------------- ABR GREEDY2 segment #${segmentNo} ----------------------`)

        // ================ INIT ========================
        const cam: FreeCamera = this.cameraManager.getCamera();
        
        // let objects: DMeshObject[] = [];
        let visiblesLater: DMeshObject[] = [];
        // let visiblesLaterNames: String[] = [];


        // Skip viewport prediction for first x frames due to stationary camera while building startup buffer
        // Beyond x frames, also skip if playback (and hence rendering) has not began as we can't assess object visibility
        // if (segmentNo <= (this.playbackManager.getMinBufferForStartup() * this.playbackManager.targetPlaybackFps) || !this.playbackManager.hasPlaybackStarted) { 
        
        // Skip viewport prediction and get all objects if playback has not started (if playback (and hence rendering) has not began, we can't assess object visibility)
        if (!this.playbackManager.hasPlaybackStartedAfterStartupDelay) {
            visiblesLater = this.objectManager.getAllObjects();
        } 
        else {
            const cameraLater: FreeCamera = this.cameraManager.getCameraInTime(this.playbackManager.getCurrentBufferInSeconds());  // Temporal horizon for prediction = curr buffer size (instead of fixed value)
            visiblesLater = this.objectManager.getVisibleObjects(cameraLater);
            StatsLogger.logStatsByVpPrediction(cameraLater, visiblesLater, this.cameraManager.getPositionSamples(), this.cameraManager.getRotationSamples(), segmentNo);
            cameraLater.dispose();

            // Objects combine list of visiblesNow and visiblesLater
            // objects = [...visiblesNow, ...visiblesLater.filter( o => !~visiblesNow.indexOf(o) )];  // !~indexOf returns true if element is not in array and false if it is in
        }
        // visiblesLaterNames = visiblesLater.map(o => o.getMetadata().name);

        const objectsToRetrieve: Array<{ object: DMeshObject, utility: number, level: number, isVisible: boolean }> = [];  // Stores objs with utility and next quality level as determined by the ABR

        // ================== GETTING THE UTILITY AND SORTING =======================
        for (const obj of this.objectManager.getAllObjects()) {
            let isVisible: boolean;
            if (~visiblesLater.indexOf(obj)) {
                isVisible = true;
            } 
            else { isVisible = false; }

            objectsToRetrieve.push({ object: obj, utility: Metrics.calcUtility(obj, cam), level: 0, isVisible: isVisible }); // Start from lowest quality level 
        };

        // Sorting our utilities array by descending utility (highest utility first)
        objectsToRetrieve.sort((a, b) => - a.utility + b.utility);
        

        // ================= EXECUTING OUR STRATEGY =======================
        const bw = SpeedManager.getBandwidth();  // KBps
        const ds = SpeedManager.getDSpeed();  // KBps
        const budget = bw * this.SEG_DUR;
        
        // Init usedBytes with the level 0 of each obj
        let usedBytes = 0;
        objectsToRetrieve.forEach((item) => usedBytes += item.object.getLevelSize(item.level)); // TODO: convert getLevelSize() to getSegmentSize(segmentNum, level)

        // Looping on all objects (ordered by highest utility first)
        for (let i = 0; i < objectsToRetrieve.length; i++) {

            if (!objectsToRetrieve[i].isVisible) {
                continue;  // For non-visible objects, we make do with the lowest level
            }

            // const objLevel = objectsToRetrieve[i];
            const currentObject = objectsToRetrieve[i].object;
            let currentLevel = objectsToRetrieve[i].level; // Initialized with level 0

            // Looping on the levels until our budget is reached
            // NB: Each trial is on (currentLevel + 1)
            while (currentLevel + 1 < currentObject.getNumberOfLevels()) {
                // Calculating the additional cost to download the mesh of the next level
                let cost = currentObject.getLevelSize(currentLevel + 1) - currentObject.getLevelSize(currentLevel);   // TODO: Check if this is geo or texture (ensure it's both)
                
                // console.log(`>>>>>>  [Trying level ${currentLevel+1}] usedBytes + cost > budget ? (${usedBytes} + ${cost} > ${budget} ?)`)

                // If it costs too much for our budget, we go on to the next object
                //  otherwise, we set the level to download to this trialled level
                if (usedBytes + cost > budget) { 
                    // console.log('>>>>>>  cost too much!!')
                    break; 
                }
                else {
                    // console.log('>>>>>>  cost is ok')
                    usedBytes += cost;
                    currentLevel++;
                    objectsToRetrieve[i].level = currentLevel;
                    // newLevel = true; // Don't think we need this anymore
                }
            }
        }

        // For debugging
        console.log(`[Results]`);
        console.log(`>>>>>>  usedBytes: ${usedBytes}`);
        for (let i = 0; i < objectsToRetrieve.length; i++) {
            console.log(`[i=${i}]`);
            console.log(`>>>>>>  objectsToRetrieve[i].object: ${objectsToRetrieve[i].object.getFolderPath()}`);
            console.log(`>>>>>>  objectsToRetrieve[i].level: ${objectsToRetrieve[i].level}`);
            console.log('>>>>>>');
        }

        return objectsToRetrieve;
    }


    /**
     * Uniform strategy proposed in paper Towards 6DoF HTTP Adaptive Streaming Through Point Cloud Compression
     * For this strategy, we try to allocate the same LoD for all objects in decreasing utility before considering the next LoD
     */
    private uniform2(segmentNo: number): Array<{ object: DMeshObject, utility: number, level: number }> {
        console.log(`\n---------------------- ABR UNIFORM2 segment #${segmentNo} ----------------------`)

        // ================ INIT ========================
        const cam: FreeCamera = this.cameraManager.getCamera();
        
        let visiblesLater: DMeshObject[] = [];

        // Skip viewport prediction and get all objects if playback has not started (if playback (and hence rendering) has not began, we can't assess object visibility)
        if (!this.playbackManager.hasPlaybackStartedAfterStartupDelay) { 
            visiblesLater = this.objectManager.getAllObjects();
        } 
        else {
            const cameraLater: FreeCamera = this.cameraManager.getCameraInTime(this.playbackManager.getCurrentBufferInSeconds());  // Temporal horizon for prediction = curr buffer size (instead of fixed value)
            visiblesLater = this.objectManager.getVisibleObjects(cameraLater);
            StatsLogger.logStatsByVpPrediction(cameraLater, visiblesLater, this.cameraManager.getPositionSamples(), this.cameraManager.getRotationSamples(), segmentNo);
            cameraLater.dispose();
        }

        const objectsToRetrieve: Array<{ object: DMeshObject, utility: number, level: number, isVisible: boolean }> = [];  // Stores objs with utility and next quality level as determined by the ABR

        // ================== GETTING THE UTILITY AND SORTING =======================
        for (const obj of this.objectManager.getAllObjects()) {
            let isVisible: boolean;
            if (~visiblesLater.indexOf(obj)) {
                isVisible = true;
            } 
            else { isVisible = false; }

            objectsToRetrieve.push({ object: obj, utility: Metrics.calcUtility(obj, cam), level: 0, isVisible: isVisible }); // Start from lowest quality level 
        };

        // Sorting our utilities array by descending utility (highest utility first)
        objectsToRetrieve.sort((a, b) => - a.utility + b.utility);
        

        // ================= EXECUTING OUR STRATEGY =======================
        const bw = SpeedManager.getBandwidth();  // KBps
        const ds = SpeedManager.getDSpeed();  // KBps
        const budget = bw * this.SEG_DUR;
        
        // Init usedBytes with the level 0 of each obj
        let usedBytes = 0;
        objectsToRetrieve.forEach((item) => usedBytes += item.object.getLevelSize(item.level)); // TODO: convert getLevelSize() to getSegmentSize(segmentNum, level)
        let endLoDLoop = false;


        // Looping on all possible levels starting with the next possible level (=1)
        // (`if` statement below will ensure we don't exceed individual obj's max level later)
        for (let l = 1; l < this.objectManager.getMaxNumOfLevelsAcrossObjects(); l++) {
            if (endLoDLoop) break;
            console.log(`[Loop] level: ${l}`)

            // Looping on all objects (ordered by highest utility first)
            for (let i = 0; i < objectsToRetrieve.length; i++) {

                if (!objectsToRetrieve[i].isVisible) {
                    continue;  // For non-visible objects, we make do with the lowest level
                }
                
                const currentObject = objectsToRetrieve[i].object;
                let currentLevel = objectsToRetrieve[i].level; // Initialized with level 0
                // usedBytes += currentObject.getLevelSize(currentLevel);

                console.log(`[Loop] obj: ${currentObject.getFolderPath()} >>>>>>`)

                // Checking if the trialled level is present in obj and if it would exceed the budget
                // NB: Each trial is on (currentLevel + 1)
                if (currentLevel + 1 < currentObject.getNumberOfLevels()) {
                
                    // Calculating the additional cost to download the mesh of the next level
                    let cost = currentObject.getLevelSize(currentLevel + 1) - currentObject.getLevelSize(currentLevel);   // TODO: Check if this is geo or texture (ensure it's both)
                    
                    console.log(`>>>>>> [Trying level ${currentLevel+1}] usedBytes + cost > budget ? (${usedBytes} + ${cost} > ${budget} ?)`)

                    // If it costs too much for our budget, we go on to the next object
                    //  otherwise, we set the level to download to this trialled level
                    if (usedBytes + cost > budget) { 
                        console.log('>>>>>>  cost too much!!');
                        if ((i + 1) == objectsToRetrieve.length) endLoDLoop = true; // If last obj in this LoD iteration, end loop as no need to trial larger-sized LoD
                        continue;
                    }
                    else {
                        console.log('>>>>>>  cost is ok');
                        usedBytes += cost;
                        currentLevel++;
                        objectsToRetrieve[i].level = currentLevel;
                        // newLevel = true; // Don't think we need this anymore
                    }
                }
            }
        }

        //
        // For debugging
        //
        // console.log(`[Results]`);
        // console.log(`>>>>>>  usedBytes: ${usedBytes}`);
        // for (let i = 0; i < objectsToRetrieve.length; i++) {
        //     console.log(`[i=${i}]`);
        //     console.log(`>>>>>>  objectsToRetrieve[i].object: ${objectsToRetrieve[i].object.getFolderPath()}`);
        //     console.log(`>>>>>>  objectsToRetrieve[i].level: ${objectsToRetrieve[i].level}`);
        //     console.log('>>>>>>');
        // }

        return objectsToRetrieve;
    }




    /**
     * Bola strategy
     */
    private bola1(segmentNo: number): Array<{ object: DMeshObject, utility: number, level: number }> {
        console.log(`\n---------------------- ABR BOLA1 segment #${segmentNo} ----------------------`)

        // ================ INIT ========================
        const cam: FreeCamera = this.cameraManager.getCamera();
        
        // let objects: DMeshObject[] = [];
        let visiblesLater: DMeshObject[] = [];

        // Skip viewport prediction and get all objects if playback has not started (if playback (and hence rendering) has not began, we can't assess object visibility)
        if (!this.playbackManager.hasPlaybackStartedAfterStartupDelay) {
            visiblesLater = this.objectManager.getAllObjects();
        } 
        else {
            // const cameraLater: FreeCamera = this.cameraManager.getCameraInTime(this.playbackManager.getCurrentBufferInSeconds());  // Temporal horizon for prediction = curr buffer size (instead of fixed value)
            const cameraLater: FreeCamera = this.cameraManager.getCameraInTime((segmentNo-this.playbackManager.nextFrameNoForPlayback-1)/this.utils.targetPlaybackFps);  // Temporal horizon for prediction
            visiblesLater = this.objectManager.getVisibleObjects(cameraLater);
            StatsLogger.logStatsByVpPrediction(cameraLater, visiblesLater, this.cameraManager.getPositionSamples(), this.cameraManager.getRotationSamples(), segmentNo);
            cameraLater.dispose();
        }

        const objectsToRetrieve: Array<{ object: DMeshObject, utility: number, level: number, isVisible: boolean }> = [];  // Stores objs with utility and next quality level as determined by the ABR

        
        // ================= EXECUTING OUR STRATEGY =======================
        for (const obj of this.objectManager.getAllObjects()) {

            let maxOptimizationVal = Number.NEGATIVE_INFINITY;
            let selectedLevel = 0;

            let isVisible: boolean;
            if (~visiblesLater.indexOf(obj)) {
                isVisible = true;
            } 
            else { isVisible = false; }

            if (isVisible) {
                // Trial levels only if object is visible
                // Otherwise, for non-visible objects, we make do with the lowest level
                for (let m = 0; m < this.objectManager.getMaxNumOfLevelsAcrossObjects(); m++) {
                    
                    let S_1 = obj.getLevelSize(0);
                    let S_m = obj.getLevelSize(m);
                    let v_m = Math.log(2 * S_m / S_1);
                    let p_kd = 1;   //For future viewport prediction

                    let delta = this.SEG_DUR;
                    let V = this.utils.chosenBolaV;        // BOLA360 section 4.3
                    let gamma = this.utils.chosenBolaGamma;    // BOLA360 section 4.3

                    let Q_tk = this.playbackManager.getCurrentBufferInSeconds();

                    let optimizationVal = (V * (v_m * p_kd + gamma * delta) - Q_tk / delta) / S_m;
                    if (optimizationVal > maxOptimizationVal) {
                        maxOptimizationVal = optimizationVal;
                        selectedLevel = m;
                    }

                    //
                    // For debugging
                    //
                    // console.log(`\nTrial... obj: ${obj.getFolderPath()}, level: ${m}`);
                    // console.log(`S_1: ${S_1}, S_m: ${S_m}, v_m: ${v_m}`);
                    // console.log(`delta: ${delta}, V: ${V}, gamma: ${gamma}, Q_tk: ${Q_tk}`);
                    // console.log(`optimizationVal: ${optimizationVal}`);
                }
            }

            objectsToRetrieve.push({ object: obj, utility: maxOptimizationVal, level: selectedLevel, isVisible: isVisible });

            // console.log(`\n================`)
            // console.log(`>>>> Done... obj: ${obj.getFolderPath()}, utility: ${maxOptimizationVal}, level: ${selectedLevel}`);
            // console.log(`================`)
        };

        // Sorting our utilities array by descending utility (highest utility first)
        objectsToRetrieve.sort((a, b) => - a.utility + b.utility);

        return objectsToRetrieve;
    }



    public setAbrFileInput(abrFileInput: AbrSegmentInput[]) {
        this.abrFileInput = abrFileInput;
    } 

    // Not in use
    private fromfileinput(segmentNo: number): Array<{ object: DMeshObject, utility: number, level: number }> {

        console.log(`>>>>>> ---------------------- ABR FROMFILEINPUT segment #${segmentNo} ----------------------`)

        // ================ INIT ========================
        const cam: FreeCamera = this.cameraManager.getCamera();
        const objects: DMeshObject[] = this.objectManager.getAllObjects();
        const objectsToRetrieve: Array<{ object: DMeshObject, utility: number, level: number }> = [];  // Stores objs with utility and next quality level as determined by the ABR
        // let newLevel = false;       // Will remain false if we don't select a level
        
        // ================== GETTING THE UTILITY AND SORTING =======================
        for (const obj of objects) {

            let geometryQuality = null;

            for (let i = 0; i < this.abrFileInput.length; i++) {
                if (obj.getFolderPath().includes(this.abrFileInput[i].objectName) 
                    && segmentNo == Number(this.abrFileInput[i].segmentId)) {
                        geometryQuality = this.abrFileInput[i].geometryQuality;
                }
            }

            if (geometryQuality == null) {
                console.error(`Error! Obj segment not found in abrFileInput (obj: ${obj.getFolderPath()}, segmentNo: ${segmentNo}). Defaulting to lowest quality..`)
                geometryQuality = 0;
            }

            console.log(`>>>>>> obj: ${obj.getFolderPath()}, segmentNo: ${segmentNo}, level: ${geometryQuality}`)

            objectsToRetrieve.push({ object: obj, utility: -1, level: geometryQuality });
        };
        
        return objectsToRetrieve;
    }
}