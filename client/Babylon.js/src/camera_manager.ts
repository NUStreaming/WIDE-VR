import { FreeCamera } from "@babylonjs/core";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { WebXRCamera } from "@babylonjs/core/XR/webXRCamera";
import Utils from "./game_utils";

export enum VpStrategyChoice {
    None,
    LinearPredictor,
    LinearRegression,
    WeightedLinearRegression
}

/**
 * Utility singleton class that gives us the active camera and the predicted one
 */
export default class CameraManager {
    private utils: Utils;

    // private prevRotation: Vector3;              // The rotation of the active camera at the previous frame
    // private prevRotQuaternion: Quaternion;
    // private prevPosition: Vector3;              // The position of the active camera at the previous frame

    private positionSamples: Vector3[];          // The position of the active camera at the previous frames
    private rotationSamples: Vector3[];          // The rotation of the active camera at the previous frames

    private positionSamples2D: {p: Vector3, timestamp: number}[];  // The position of the active camera at the previous frames
    private rotationSamples2D: {r: Vector3, timestamp: number}[];  // The rotation of the active camera at the previous frames

    private lastSavedTime: number = 0;          // The frame number when the position and rotation were last saved
    
    // private maxSamples: number = 24;              // Maximum number of samples to keep
    // private maxSamples: number = 240;              // Maximum number of samples to keep
    private maxSamples: number;                     // Maximum number of samples to keep

    private _chosenVpStrategy: VpStrategyChoice = VpStrategyChoice.None; // The strategy to use for viewport prediction

    private minSamplesRegression: number = 2;    // Minimum number of samples required to perform regression

    /**
     * Create a new Camera Manager.  
     * Private constructor because CameraManager is a singleton
     */
    public constructor(utils: Utils) {
        // this.prevPosition = Vector3.Zero();
        // this.prevRotation = Vector3.Zero();
        // this.prevRotQuaternion = Quaternion.Identity();

        this.positionSamples = [];
        this.rotationSamples = [];

        this.positionSamples2D = [];
        this.rotationSamples2D = [];

        this.utils = utils;
        this.maxSamples = this.utils.targetPlaybackFps; // Maximum number of samples to keep is equal to the target playback FPS
        // this.maxSamples = 5;
    }


    public setVpStrategy(vpStrategy: VpStrategyChoice) {
        this._chosenVpStrategy = vpStrategy;
    }
    
    public getChosenVpStrategy = (): VpStrategyChoice => {
        return this._chosenVpStrategy;
    }
    
    public getChosenVpStrategyAsString = (): string => {
        return this.getVpStrategyAsString(this._chosenVpStrategy);
    }

    public getVpStrategyAsString = (vpStrategy: VpStrategyChoice): string => {
        switch(vpStrategy) {
            case VpStrategyChoice.None:
                return "None";
            case VpStrategyChoice.LinearPredictor:
                return "LinearPredictor";
            case VpStrategyChoice.LinearRegression:
                return "LinearRegression";
            case VpStrategyChoice.WeightedLinearRegression:
                return "WeightedLinearRegression";
        }
    }

    // /**
    //  * Call this method after updating to save the camera's position and rotation
    //  */
    // public saveCameraPosition = (): void => {
    //     const cam = this.getCamera();

    //     // .clone() is required so that we don't get a reference
    //     this.prevPosition = cam.position.clone();
    //     // console.log('Position & rotation:')
    //     // console.log(this.prevPosition);

    //     //  UniversalCamera uses rotation and WebXRCamera uses rotationQuaternion !
    //     if (cam instanceof WebXRCamera) {
    //         this.prevRotQuaternion = cam.rotationQuaternion.clone();
            
    //         // console.log('>>> WebXRCamera');
    //         // console.log(this.prevRotQuaternion);
    //     }
    //     else {
    //         this.prevRotation = cam.rotation.clone();

    //         // console.log('>>> UniversalCamera');
    //         // console.log(this.prevRotation);
    //     }
    // }

    
    /**
     * Call this method at regular intervals to save the camera's position and rotation samples
     */
    public saveCameraPosition = (): void => {
        const cam = this.getCamera();

        let timeNow = performance.now();
        this.lastSavedTime = timeNow;

        // .clone() is required so that we don't get a reference
        let currPosition = cam.position.clone();
        let currRotation = cam.rotation.clone();

        this.positionSamples.push(currPosition);
        this.positionSamples2D.push({p: currPosition, timestamp: timeNow});

        // Remove oldest position sample if buffer exceeds max size
        if (this.positionSamples.length > this.maxSamples) {
            this.positionSamples.shift();
            this.positionSamples2D.shift();
        }

        this.rotationSamples.push(currRotation);
        this.rotationSamples2D.push({r: currRotation, timestamp: timeNow});

        // Remove oldest rotation sample if buffer exceeds max size
        if (this.rotationSamples.length > this.maxSamples) {
            this.rotationSamples.shift();
            this.rotationSamples2D.shift();
        }
    }

    /**
     * Returns the currently active camera as a FreeCamera
     */
    public getCamera = (): FreeCamera => {
        let cam = this.utils.scene.activeCamera;

        if (cam) {
            try {
                if (cam instanceof WebXRCamera) {
                    return cam as WebXRCamera;
                }
                else if (cam instanceof UniversalCamera) {
                    return cam as UniversalCamera;
                }
                else {
                    return cam as FreeCamera;
                }
            }
            catch(e) {
                throw e;
            }
        }
        else {
            throw "Camera Error : No active camera yet !";
        }
    }

    // /**
    //  * Returns a linear prediction of the active camera in delta seconds.  
    //  * Don't forget to dispose of this camera after use for memory reasons.
    //  * @param delta Time elapsed before prediction
    //  */
    // public getCameraInTime = (delta: number): FreeCamera => {
    //     // We make a copy of the active camera
    //     let futureCamera: FreeCamera;
    //     const currentCamera = this.getCamera();
    //     futureCamera = currentCamera.clone("futureCamera") as FreeCamera;

    //     // This is the time since last frame
    //     //  (when we save the position and rotation)
    //     const deltaTime = this.utils.scene.deltaTime;

    //     // Linear prediction of the position
    //     const deltaPos = futureCamera.position
    //                     .subtract(this.prevPosition)
    //                     .scale(delta * 1000 / deltaTime);
    //     futureCamera.position
    //         .addInPlace(deltaPos);

    //     // Linear prediction of the rotation
    //     //  As UniversalCamera uses rotation and WebXRCamera uses rotationQuaternion,
    //     //  we have to separate the 2 cases
    //     if (currentCamera instanceof WebXRCamera) {
    //         const currentRotation = currentCamera.rotationQuaternion;
    //         const deltaRotQuatUnscaled = currentRotation
    //                                 .multiply(Quaternion.Inverse(this.prevRotQuaternion));
    //         const nextRotation = Quaternion.Slerp(   
    //                             currentRotation, 
    //                             currentRotation
    //                                 .multiply(deltaRotQuatUnscaled),
    //                             delta * 1000 / deltaTime
    //                         );
    
    //         futureCamera.rotationQuaternion = nextRotation;

    //         // As the predicted camera is not a WebXRCamera, we have to rotate it beforehand ; it won't be rotated afterwards
    //         //  Check ObjectManager.getVisibleObjects
    //         futureCamera.rotationQuaternion.multiplyInPlace(Quaternion.FromEulerAngles(0, -Math.PI, 0));
    //     }
    //     else {
    //         const deltaRot = futureCamera.rotation
    //                     .subtract(this.prevRotation)
    //                     .scale(delta * 1000 / deltaTime);
    //         futureCamera.rotation
    //             .addInPlace(deltaRot);
    //     }        
        
    //     // Forcing computation of matrices
    //     futureCamera.getViewMatrix(true);
    //     futureCamera.getProjectionMatrix(true);
        
    //     // Return the predicted camera (has to be destroyed after being use)
    //     return futureCamera;
    // }

    

    /**
     * Returns a prediction of the active camera in delta seconds based on selected VP (viewport prediction) strategy. 
     * Don't forget to dispose of this camera after use for memory reasons.
     * @param delta Time elapsed before prediction
     */
    public getCameraInTime = (delta: number): FreeCamera => {
        const currentCamera = this.getCamera();

        //  As UniversalCamera uses rotation and WebXRCamera uses rotationQuaternion,
        //  we have to separate the 2 cases
        if (currentCamera instanceof WebXRCamera) {
            console.log('>>> Camera object is instanceof WebXRCamera which is currently not supported; returning currentCamera instead..');
            return currentCamera;
        }

        // We make a copy of the active camera
        let futureCamera: FreeCamera;
        futureCamera = currentCamera.clone("futureCamera") as FreeCamera;

        console.log('>>> futureCamera (before):');
        console.log(futureCamera.position);
        console.log(futureCamera.rotation);

        switch (this._chosenVpStrategy) {
            case VpStrategyChoice.LinearPredictor:
                futureCamera = this.vpLinearPredictor(futureCamera, delta);
                break;
            case VpStrategyChoice.LinearRegression:
                futureCamera = this.vpLinearRegression(futureCamera, delta, false); // isWeightedLr = false
                break;
            case VpStrategyChoice.WeightedLinearRegression:
                futureCamera = this.vpLinearRegression(futureCamera, delta, true); // isWeightedLr = true
                break;
            case VpStrategyChoice.None:
            default:
                break;  // Simply returns the currentCamera, i.e. no prediction happens
        }

        console.log('>>> futureCamera (after):');
        console.log(futureCamera.position);
        console.log(futureCamera.rotation);
        
        // Forcing computation of matrices
        futureCamera.getViewMatrix(true);
        futureCamera.getProjectionMatrix(true);
        
        // Return the predicted camera (has to be destroyed after being use)
        return futureCamera;
    }

    /**
     * Viewport prediction using simple linear predictor based on single t_-1 sample
     */
    private vpLinearPredictor_Original(futureCamera: FreeCamera, delta: number): FreeCamera {
        console.log(`futureCamera.position (bef): ${futureCamera.position}`);
        // This is the time since last frame
        //  (when we last saved the position and rotation)
        // const deltaTime = this.utils.scene.deltaTime;

        // Linear prediction of the position based on last sample only
        // const deltaPos = futureCamera.position
        //                 .subtract(this.positionSamples2D[this.positionSamples2D.length-1].p)
        //                 .scale(delta * 1000 / deltaTime);
        // futureCamera.position
        //     .addInPlace(deltaPos);




        // let timeNow = performance.now();
        // const deltaTime = timeNow - this.positionSamples2D[this.positionSamples2D.length-1].timestamp;

        // Linear prediction of the position based on last two samples only
        const timeNow = performance.now();
        let lastSample = this.positionSamples2D[this.positionSamples2D.length-1];
        let secondLastSample = this.positionSamples2D[this.positionSamples2D.length-2];
        const deltaTime = lastSample.timestamp - secondLastSample.timestamp;;
        const deltaPos = lastSample.p
                        .subtract(secondLastSample.p)
                        .scale(delta * 1000 / deltaTime);
        futureCamera.position
            .addInPlace(deltaPos);

        console.log('98765')
        console.log(`timeNow: ${timeNow}`);
        console.log(`this.utils.scene.deltaTime: ${this.utils.scene.deltaTime}`);
        console.log(`deltaTime: ${deltaTime}`);
        console.log(`delta: ${delta}`);
        console.log(`delta * 1000 / deltaTime: ${delta * 1000 / deltaTime}`);
        console.log(this.positionSamples2D);
        console.log(this.positionSamples2D[this.positionSamples2D.length-1])
        console.log(`futureCamera.position (aft): ${futureCamera.position}`);




        // Linear prediction of the rotation based on last sample only
        const deltaRot = futureCamera.rotation
                    .subtract(this.rotationSamples2D[this.rotationSamples2D.length-1].r)
                    .scale(delta * 1000 / deltaTime);
        futureCamera.rotation
            .addInPlace(deltaRot);

        console.log('@@@@@@@@@@@@@@@@@@@@@ vpLinearPredictor');
        console.log(`this.positionSamples[this.positionSamples.length-1]: ${this.positionSamples[this.positionSamples.length-1]}`);
        console.log(`this.rotationSamples[this.rotationSamples.length-1]: ${this.rotationSamples[this.rotationSamples.length-1]}`);
        console.log(`delta: ${delta}`);
        console.log(`deltaPos: ${deltaPos}`);
        console.log(`deltaRot: ${deltaRot}`);

        return futureCamera;
    }



    /**
     * Viewport prediction using linear regression based on past n samples to predict position and rotation in `delta` seconds
     */
    private vpLinearPredictor(futureCamera: FreeCamera, delta: number): FreeCamera {
        // Ensure we have enough samples
        if (this.positionSamples.length < 2 || this.rotationSamples.length < 2) {
            return futureCamera; // Not enough samples, return the current state
        }
        
        const pX = this.positionSamples2D.slice(0, 2).map(sample => sample.p.x);
        const pY = this.positionSamples2D.slice(0, 2).map(sample => sample.p.y);
        const pZ = this.positionSamples2D.slice(0, 2).map(sample => sample.p.z);
        const ptimestamp = this.positionSamples2D.slice(0, 2).map(sample => sample.timestamp);

        let slope_pX, intercept_pX, slope_pY, intercept_pY, slope_pZ, intercept_pZ;
        // ({ slope: slope_pX, intercept: intercept_pX } = this.calcLinearRegressionParams2D(pX, ptimestamp));
        // ({ slope: slope_pY, intercept: intercept_pY } = this.calcLinearRegressionParams2D(pY, ptimestamp));
        // ({ slope: slope_pZ, intercept: intercept_pZ } = this.calcLinearRegressionParams2D(pZ, ptimestamp));
        ({ slope: slope_pX, intercept: intercept_pX } = this.calcLinearRegressionParams2D(ptimestamp, pX));
        ({ slope: slope_pY, intercept: intercept_pY } = this.calcLinearRegressionParams2D(ptimestamp, pY));
        ({ slope: slope_pZ, intercept: intercept_pZ } = this.calcLinearRegressionParams2D(ptimestamp, pZ));

        // predAt is based on the timestamp of the sample to be predicted
        const predAt = performance.now() + delta * 1000;

        const futurePosition = new Vector3(
            this.predLinearRegression(slope_pX, intercept_pX, predAt), 
            this.predLinearRegression(slope_pY, intercept_pY, predAt), 
            this.predLinearRegression(slope_pZ, intercept_pZ, predAt)
        );
        futureCamera.position = futurePosition;

        console.log(`predAt: ${predAt}`);
        console.log(`futurePosition: ${futurePosition}`);

        const rX = this.rotationSamples2D.slice(0, 2).map(sample => sample.r.x);
        const rY = this.rotationSamples2D.slice(0, 2).map(sample => sample.r.y);
        const rZ = this.rotationSamples2D.slice(0, 2).map(sample => sample.r.z);
        const rtimestamp = this.rotationSamples2D.slice(0, 2).map(sample => sample.timestamp);

        let slope_rX, intercept_rX, slope_rY, intercept_rY, slope_rZ, intercept_rZ;
        // ({ slope: slope_rX, intercept: intercept_rX } = this.calcLinearRegressionParams2D(rX, rtimestamp));
        // ({ slope: slope_rY, intercept: intercept_rY } = this.calcLinearRegressionParams2D(rY, rtimestamp));
        // ({ slope: slope_rZ, intercept: intercept_rZ } = this.calcLinearRegressionParams2D(rZ, rtimestamp));
        ({ slope: slope_rX, intercept: intercept_rX } = this.calcLinearRegressionParams2D(rtimestamp, rX));
        ({ slope: slope_rY, intercept: intercept_rY } = this.calcLinearRegressionParams2D(rtimestamp, rY));
        ({ slope: slope_rZ, intercept: intercept_rZ } = this.calcLinearRegressionParams2D(rtimestamp, rZ));

        // Predict rotation at [sampleCount + (delta * frame_rate)]
        const futureRotation = new Vector3(
            this.predLinearRegression(slope_rX, intercept_rX, predAt), 
            this.predLinearRegression(slope_rY, intercept_rY, predAt), 
            this.predLinearRegression(slope_rZ, intercept_rZ, predAt)
        );
        futureCamera.rotation = futureRotation;

        //
        // For debugging and verification
        //
        // console.log(`@@@@@@@@@@@@@@@@@@@@@ vpLinearRegression (isWeightedLr:${isWeightedLr}) ROTATION`);
        // console.log(`delta: ${delta}`);
        // console.log(`futureRotation: ${futureRotation}`);
        // let rxstr='';
        // let rystr='';
        // let rzstr='';
        // for (let i = 0; i < this.rotationSamples.length; i++) {
        //     rxstr += this.rotationSamples[i].x.toFixed(5) + ',';
        //     rystr += this.rotationSamples[i].y.toFixed(5) + ',';
        //     rzstr += this.rotationSamples[i].z.toFixed(5) + ',';
        // }
        // console.log(rxstr);
        // console.log(rystr);
        // console.log(rzstr);


        // Return futureCamera updated with predicted position and rotation
        return futureCamera;
    }











    
    
    // /**
    //  * Viewport prediction using linear regression based on past n samples
    //  */
    // private vpLinearRegression(futureCamera: FreeCamera, delta: number): FreeCamera {
    //     // Ensure we have enough samples to perform regression
    //     if (this.positionSamples.length < this.minSamplesRegression || this.rotationSamples.length < this.minSamplesRegression) {
    //         return futureCamera; // Not enough samples, return the current state
    //     }

    //     // Calculate linear regression for position samples
    //     // const { slope: posSlope, intercept: posIntercept } = this.calcLinearRegressionParams(this.positionSamples);
    //     // const futurePosition = posSlope.scale(delta).add(posIntercept);
    //     // futureCamera.position = futurePosition;

    //     const { slope: posSlope, intercept: posIntercept } = this.calcLinearRegressionParams(this.positionSamples);
    //     const futurePosition = posSlope.scale(delta).add(posIntercept);
    //     futureCamera.position = futurePosition;


    //     console.log('@@@@@@@@@@@@@@@@@@@@@ vpLinearRegression');
    //     console.log(`delta: ${delta}`);
    //     console.log(`posSlope: ${posSlope}`);
    //     console.log(`posIntercept: ${posIntercept}`);
    //     console.log(`futurePosition: ${futurePosition}`);
    //     console.log(this.positionSamples)
        
    //     let xstr='';
    //     let ystr='';
    //     let zstr='';
    //     for (let i = 0; i < this.positionSamples.length; i++) {
    //         xstr += this.positionSamples[i].x.toFixed(5) + ',';
    //         ystr += this.positionSamples[i].y.toFixed(5) + ',';
    //         zstr += this.positionSamples[i].z.toFixed(5) + ',';
    //     }
    //     console.log(xstr);
    //     console.log(ystr);
    //     console.log(zstr);

    //     // Calculate linear regression for rotation samples
    //     const { slope: rotSlope, intercept: rotIntercept } = this.calcLinearRegressionParams(this.rotationSamples);
    //     const futureRotation = rotSlope.scale(delta).add(rotIntercept);
    //     futureCamera.rotation = futureRotation;

    //     return futureCamera;
    // }

    // private calcLinearRegressionParams(samples: Vector3[]): { slope: Vector3, intercept: Vector3 } {
    //     const n = samples.length;
    //     let sumX = 0, sumY = new Vector3(0, 0, 0), sumXY = new Vector3(0, 0, 0), sumX2 = 0;

    //     for (let i = 0; i < n; i++) {
    //         sumX += i;
    //         sumY.addInPlace(samples[i]);
    //         sumXY.addInPlace(samples[i].scale(i));
    //         sumX2 += i * i;
    //     }

    //     const slope = sumXY.scale(n).subtract(sumY.scale(sumX)).scale(1 / (n * sumX2 - sumX * sumX));
    //     const intercept = sumY.subtract(slope.scale(sumX)).scale(1 / n);

    //     return { slope, intercept };
    // }

    
    
    
    /**
     * Viewport prediction using linear regression based on past n samples to predict position and rotation in `delta` seconds
     */
    private vpLinearRegression(futureCamera: FreeCamera, delta: number, isWeightedLr: boolean): FreeCamera {
        // Ensure we have enough samples to perform regression
        if (this.positionSamples.length < this.minSamplesRegression || this.rotationSamples.length < this.minSamplesRegression) {
            return futureCamera; // Not enough samples, return the current state
        }

        // Apply linear regression to x, y, and z positional coordinates
        // const pX = this.positionSamples.map(p => p.x);
        // const pY = this.positionSamples.map(p => p.y);
        // const pZ = this.positionSamples.map(p => p.z);
        
        const pX = this.positionSamples2D.map(sample => sample.p.x);
        const pY = this.positionSamples2D.map(sample => sample.p.y);
        const pZ = this.positionSamples2D.map(sample => sample.p.z);
        const ptimestamp = this.positionSamples2D.map(sample => sample.timestamp);

        let slope_pX, intercept_pX, slope_pY, intercept_pY, slope_pZ, intercept_pZ;

        if (!isWeightedLr) {
            // ({ slope: slope_pX, intercept: intercept_pX } = this.calcLinearRegressionParams(pX));
            // ({ slope: slope_pY, intercept: intercept_pY } = this.calcLinearRegressionParams(pY));
            // ({ slope: slope_pZ, intercept: intercept_pZ } = this.calcLinearRegressionParams(pZ));
            
            // ({ slope: slope_pX, intercept: intercept_pX } = this.calcLinearRegressionParams2D(pX, ptimestamp));
            // ({ slope: slope_pY, intercept: intercept_pY } = this.calcLinearRegressionParams2D(pY, ptimestamp));
            // ({ slope: slope_pZ, intercept: intercept_pZ } = this.calcLinearRegressionParams2D(pZ, ptimestamp));
            ({ slope: slope_pX, intercept: intercept_pX } = this.calcLinearRegressionParams2D(ptimestamp, pX));
            ({ slope: slope_pY, intercept: intercept_pY } = this.calcLinearRegressionParams2D(ptimestamp, pY));
            ({ slope: slope_pZ, intercept: intercept_pZ } = this.calcLinearRegressionParams2D(ptimestamp, pZ));
        } 
        else {  // Weighted Linear Regression
            // ({ slope: slope_pX, intercept: intercept_pX } = this.calcWeightedLinearRegressionParams(pX));
            // ({ slope: slope_pY, intercept: intercept_pY } = this.calcWeightedLinearRegressionParams(pY));
            // ({ slope: slope_pZ, intercept: intercept_pZ } = this.calcWeightedLinearRegressionParams(pZ));
            
            // ({ slope: slope_pX, intercept: intercept_pX } = this.calcWeightedLinearRegressionParams2D(pX, ptimestamp));
            // ({ slope: slope_pY, intercept: intercept_pY } = this.calcWeightedLinearRegressionParams2D(pY, ptimestamp));
            // ({ slope: slope_pZ, intercept: intercept_pZ } = this.calcWeightedLinearRegressionParams2D(pZ, ptimestamp));
            ({ slope: slope_pX, intercept: intercept_pX } = this.calcWeightedLinearRegressionParams2D(ptimestamp, pX));
            ({ slope: slope_pY, intercept: intercept_pY } = this.calcWeightedLinearRegressionParams2D(ptimestamp, pY));
            ({ slope: slope_pZ, intercept: intercept_pZ } = this.calcWeightedLinearRegressionParams2D(ptimestamp, pZ));
        }

        // Predict position at [sampleCount + (delta * frame_rate)]
        // Option 1
        // const predAt = this.positionSamples.length + (delta * this.utils.targetPlaybackFps);

        // Option 2 - Makes use of lastSavedTime
        // let timeDiffInSeconds = (performance.now() - this.lastSavedTime) / 1000;
        // console.log(`delta: ${delta}`);
        // console.log(`timeDiffInSeconds: ${timeDiffInSeconds}`);
        // const predAt = this.positionSamples.length + ((delta + timeDiffInSeconds) * this.utils.targetPlaybackFps);

        // Option 3 - predAt is based on the timestamp of the sample to be predicted
        const predAt = performance.now() + delta * 1000;

        const futurePosition = new Vector3(
            this.predLinearRegression(slope_pX, intercept_pX, predAt), 
            this.predLinearRegression(slope_pY, intercept_pY, predAt), 
            this.predLinearRegression(slope_pZ, intercept_pZ, predAt)
        );
        futureCamera.position = futurePosition;

        
        console.log(`predAt: ${predAt}`);
        console.log(`futurePosition: ${futurePosition}`);

        //
        // For debugging and verification
        //
        // console.log(`@@@@@@@@@@@@@@@@@@@@@ vpLinearRegression (isWeightedLr:${isWeightedLr}) POSITION`);
        // console.log(`delta: ${delta}`);
        // console.log(`futurePosition: ${futurePosition}`);
        // console.log(`slope_pX: ${slope_pX}`);
        // console.log(`intercept_pX: ${intercept_pX}`);
        // let xstr='';
        // let ystr='';
        // let zstr='';
        // for (let i = 0; i < this.positionSamples.length; i++) {
        //     xstr += this.positionSamples[i].x.toFixed(5) + ',';
        //     ystr += this.positionSamples[i].y.toFixed(5) + ',';
        //     zstr += this.positionSamples[i].z.toFixed(5) + ',';
        // }
        // console.log(xstr);
        // console.log(ystr);
        // console.log(zstr);
        

        // Apply linear regression to x (pitch), y (yaw), and z (roll) rotational coordinates
        // Ref: https://doc.babylonjs.com/features/featuresDeepDive/mesh/transforms/center_origin/rotation_conventions
        // const rX = this.rotationSamples.map(r => r.x);
        // const rY = this.rotationSamples.map(r => r.y);
        // const rZ = this.rotationSamples.map(r => r.z);

        const rX = this.rotationSamples2D.map(sample => sample.r.x);
        const rY = this.rotationSamples2D.map(sample => sample.r.y);
        const rZ = this.rotationSamples2D.map(sample => sample.r.z);
        const rtimestamp = this.rotationSamples2D.map(sample => sample.timestamp);

        let slope_rX, intercept_rX, slope_rY, intercept_rY, slope_rZ, intercept_rZ;
        
        if (!isWeightedLr) {
            // ({ slope: slope_rX, intercept: intercept_rX } = this.calcLinearRegressionParams(rX));
            // ({ slope: slope_rY, intercept: intercept_rY } = this.calcLinearRegressionParams(rY));
            // ({ slope: slope_rZ, intercept: intercept_rZ } = this.calcLinearRegressionParams(rZ));
            
            // ({ slope: slope_rX, intercept: intercept_rX } = this.calcLinearRegressionParams2D(rX, rtimestamp));
            // ({ slope: slope_rY, intercept: intercept_rY } = this.calcLinearRegressionParams2D(rY, rtimestamp));
            // ({ slope: slope_rZ, intercept: intercept_rZ } = this.calcLinearRegressionParams2D(rZ, rtimestamp));
            ({ slope: slope_rX, intercept: intercept_rX } = this.calcLinearRegressionParams2D(rtimestamp, rX));
            ({ slope: slope_rY, intercept: intercept_rY } = this.calcLinearRegressionParams2D(rtimestamp, rY));
            ({ slope: slope_rZ, intercept: intercept_rZ } = this.calcLinearRegressionParams2D(rtimestamp, rZ));
        }
        else {  // Weighted Linear Regression
            // ({ slope: slope_rX, intercept: intercept_rX } = this.calcWeightedLinearRegressionParams(rX));
            // ({ slope: slope_rY, intercept: intercept_rY } = this.calcWeightedLinearRegressionParams(rY));
            // ({ slope: slope_rZ, intercept: intercept_rZ } = this.calcWeightedLinearRegressionParams(rZ));
            
            // ({ slope: slope_rX, intercept: intercept_rX } = this.calcWeightedLinearRegressionParams2D(rX, rtimestamp));
            // ({ slope: slope_rY, intercept: intercept_rY } = this.calcWeightedLinearRegressionParams2D(rY, rtimestamp));
            // ({ slope: slope_rZ, intercept: intercept_rZ } = this.calcWeightedLinearRegressionParams2D(rZ, rtimestamp));
            ({ slope: slope_rX, intercept: intercept_rX } = this.calcWeightedLinearRegressionParams2D(rtimestamp, rX));
            ({ slope: slope_rY, intercept: intercept_rY } = this.calcWeightedLinearRegressionParams2D(rtimestamp, rY));
            ({ slope: slope_rZ, intercept: intercept_rZ } = this.calcWeightedLinearRegressionParams2D(rtimestamp, rZ));
        }

        // Predict rotation at [sampleCount + (delta * frame_rate)]
        const futureRotation = new Vector3(
            this.predLinearRegression(slope_rX, intercept_rX, predAt), 
            this.predLinearRegression(slope_rY, intercept_rY, predAt), 
            this.predLinearRegression(slope_rZ, intercept_rZ, predAt)
        );
        futureCamera.rotation = futureRotation;

        //
        // For debugging and verification
        //
        // console.log(`@@@@@@@@@@@@@@@@@@@@@ vpLinearRegression (isWeightedLr:${isWeightedLr}) ROTATION`);
        // console.log(`delta: ${delta}`);
        // console.log(`futureRotation: ${futureRotation}`);
        // let rxstr='';
        // let rystr='';
        // let rzstr='';
        // for (let i = 0; i < this.rotationSamples.length; i++) {
        //     rxstr += this.rotationSamples[i].x.toFixed(5) + ',';
        //     rystr += this.rotationSamples[i].y.toFixed(5) + ',';
        //     rzstr += this.rotationSamples[i].z.toFixed(5) + ',';
        // }
        // console.log(rxstr);
        // console.log(rystr);
        // console.log(rzstr);


        // Return futureCamera updated with predicted position and rotation
        return futureCamera;
    }

    private calcLinearRegressionParams(samples: number[]): { slope: number, intercept: number } {
        const n = samples.length;
        let sampleCounts: number[] = [];    // Sample counts from 1 to n (a measure of time) => Independent variable
        for (let i = 1; i <= n; i++) {
            sampleCounts.push(i);
        }

        const sumT = sampleCounts.reduce((a, b) => a + b, 0);
        const sumP = samples.reduce((a, b) => a + b, 0);
        const sumT2 = sampleCounts.reduce((a, b) => a + b * b, 0);
        const sumTP = sampleCounts.reduce((sum, t, i) => sum + t * samples[i], 0);

        // Calculate slope (a) and intercept (b)
        const slope = (n * sumTP - sumT * sumP) / (n * sumT2 - sumT * sumT);
        const intercept = (sumP - slope * sumT) / n;

        return { slope, intercept };
    }

    private calcWeightedLinearRegressionParams(samples: number[]): { slope: number, intercept: number } {
        const n = samples.length;

        let sampleCounts: number[] = [];    // Sample counts from 1 to n (a measure of time) => Independent variable
        let weights: number[] = [];        // Weights for each sample
        for (let i = 1; i <= n; i++) {
            sampleCounts.push(i);
            weights.push(i/n);            // Recent samples (higher index in the `samples` array) have higher weights
        }

        // Weighted sums needed for regression calculation
        const weightedSum = (values: number[]) => values.reduce((sum: number, value: number, i: number) => sum + weights[i] * value, 0);

        const sumW = weights.reduce((a, b) => a + b, 0);
        const sumWT = weightedSum(sampleCounts);
        const sumWP = weightedSum(samples);
        const sumWT2 = weightedSum(sampleCounts.map(t => t * t));
        const sumWTP = weightedSum(sampleCounts.map((t, i) => t * samples[i]));
        
        // Calculate slope (a) and intercept (b) with weights
        const slope = (sumW * sumWTP - sumWT * sumWP) / (sumW * sumWT2 - sumWT * sumWT);
        const intercept = (sumWP - slope * sumWT) / sumW;

        return { slope, intercept };
    }

    private calcLinearRegressionParams2D(x: number[], y: number[]): { slope: number, intercept: number } {
        const n = x.length;
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumX2 = x.reduce((a, b) => a + b * b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        return { slope, intercept };
    }

    private calcWeightedLinearRegressionParams2D(x: number[], y: number[]): { slope: number, intercept: number } {
        const n = x.length;
        let weights: number[] = [];        // Weights for each sample
        for (let i = 1; i <= n; i++) {
            weights.push(i/n);            // Recent samples (higher index in the `samples` array) have higher weights
        }

        // Weighted sums needed for regression calculation
        const weightedSum = (values: number[], factor: number[]) => values.reduce((sum, value, i) => sum + factor[i] * value, 0);

        const sumW = weights.reduce((a, b) => a + b, 0);
        const sumWx = weightedSum(x, weights);
        const sumWy = weightedSum(y, weights);
        const sumWx2 = weightedSum(x.map(xi => xi * xi), weights);
        const sumWxy = weightedSum(x.map((xi, i) => xi * y[i]), weights);

        // Calculate slope (a) and intercept (b) with weights
        const slope = (sumW * sumWxy - sumWx * sumWy) / (sumW * sumWx2 - sumWx * sumWx);
        const intercept = (sumWy - slope * sumWx) / sumW;

        return { slope, intercept };
    }


    private predLinearRegression(slope: number, intercept: number, x: number): number {
        return slope * x + intercept;
    }
    
    
    // /**
    //  * Viewport prediction using weighted linear regression based on past n samples
    //  */
    // private vpWeightedLinearRegression(futureCamera: FreeCamera, delta: number): FreeCamera {
    //     // Ensure we have enough samples to perform regression
    //     if (this.positionSamples.length < this.minSamplesRegression || this.rotationSamples.length < this.minSamplesRegression) {
    //         return futureCamera; // Not enough samples, return the current state
    //     }
        
    //     // Calculate weighted linear regression for position
    //     const { slope: posSlope, intercept: posIntercept } = this.calcWeightedLinearRegressionParams(this.positionSamples);
    //     const futurePosition = posSlope.scale(delta).add(posIntercept);
    //     futureCamera.position = futurePosition;
        
    //     // Calculate weighted linear regression for rotation
    //     const { slope: rotSlope, intercept: rotIntercept } = this.calcWeightedLinearRegressionParams(this.rotationSamples);
    //     const futureRotation = rotSlope.scale(delta).add(rotIntercept);
    //     futureCamera.rotation = futureRotation;

    //     return futureCamera;
    // }

    private calcWeightedLinearRegressionParamsOLD(samples: Vector3[]): { slope: Vector3, intercept: Vector3 } {
        const n = samples.length;
        let sumW = 0, sumWX = 0, sumWY = new Vector3(0, 0, 0), sumWXY = new Vector3(0, 0, 0), sumWX2 = 0;

        for (let i = 0; i < n; i++) {
            const weight = (n - i) / n;
            sumW += weight;
            sumWX += weight * i;
            sumWY.addInPlace(samples[i].scale(weight));
            sumWXY.addInPlace(samples[i].scale(weight * i));
            sumWX2 += weight * i * i;
        }

        const slope = sumWXY.scale(sumW).subtract(sumWY.scale(sumWX)).scale(1 / (sumW * sumWX2 - sumWX * sumWX));
        const intercept = sumWY.subtract(slope.scale(sumWX)).scale(1 / sumW);

        return { slope, intercept };
    }

    public getPositionSamples = (): Vector3[] => {
        return this.positionSamples;
    }

    public getRotationSamples = (): Vector3[] => {
        return this.rotationSamples;
    }

}