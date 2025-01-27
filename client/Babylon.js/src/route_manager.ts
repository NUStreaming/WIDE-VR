import { Camera, FreeCamera, Mesh, Scene, Vector3 } from "@babylonjs/core";

import CameraManager from "./camera_manager";
import PlaybackManager from "./playback_manager";

export enum RouteChoice {
    Manual,
    BackForth,
    LeftRight,
    LeftOnly,
    LeftOnlyNonLinear,
    LeftRightLeft
}

export default class RouteManager {
    private cameraManager: CameraManager;
    private playbackManager: PlaybackManager;
    private scene: Scene;

    private _chosenRoute: RouteChoice = RouteChoice.Manual; // The route (camera path) we will execute
    
    private currDirection: Vector3|null = null;
    private prevDirectionUpdateTime: number = 0;

    public constructor(cameraManager: CameraManager, playbackManager: PlaybackManager, scene: Scene) {
        this.cameraManager = cameraManager;
        this.playbackManager = playbackManager;
        this.scene = scene;
    }

    public setRoute(route: RouteChoice) {
        this._chosenRoute = route;
    }
    
    public getChosenRoute = (): RouteChoice => {
        return this._chosenRoute;
    }
    
    public getChosenRouteAsString = (): string => {
        return this.getRouteAsString(this._chosenRoute);
    }

    public getRouteAsString = (route: RouteChoice): string => {
        switch(route) {
            case RouteChoice.Manual:
                return "Manual";
            case RouteChoice.BackForth:
                return "BackForth";
            case RouteChoice.LeftRight:
                return "LeftRight";
            case RouteChoice.LeftOnly:
                return "LeftOnly";
            case RouteChoice.LeftOnlyNonLinear:
                return "LeftOnlyNonLinear";
            case RouteChoice.LeftRightLeft:
                return "LeftRightLeft";
        }
    }


    
    public moveCameraOnChosenRoute = () => {
        switch (this._chosenRoute) {
            case RouteChoice.Manual:
                return; // Do nothing
            case RouteChoice.BackForth:
                this.backforth();
                return;
            case RouteChoice.LeftRight:
                this.leftright();
                return;
            case RouteChoice.LeftOnly:
                this.leftonly();
                return;
            case RouteChoice.LeftOnlyNonLinear:
                this.leftonlynonlinear();
                return;
            case RouteChoice.LeftRightLeft:
                this.leftrightleft();
                return;
        }
    }

    private leftright = () => {
        const cam = this.cameraManager.getCamera();
        const movementScaleFactor = 0.003;  // Affects movement speed
        // const changeDirectionInterval = 8;  // In seconds
        const changeDirectionInterval = 13;  // In seconds

        this.currDirection = Vector3.Left();  // Start moving left
        
        // This function runs before the scene renders (per engine's rendering fps)
        this.scene.onBeforeRenderObservable.add(() => {

            // Check if interval time has passed
            const currPlaybackTime = this.playbackManager.getCurrentPlaybackTime();
            if ((currPlaybackTime - this.prevDirectionUpdateTime) > changeDirectionInterval) {
                
                // Toggle direction
                if (this.currDirection?.equals(Vector3.Left())) this.currDirection = Vector3.Right();
                else this.currDirection = Vector3.Left();
                
                this.prevDirectionUpdateTime = currPlaybackTime;
            }

            // Update camera position
            if (this.currDirection && !this.playbackManager.isPlayerStalling() && !this.playbackManager.isPlaybackEnded()) {
                const deltaPos = cam.getDirection(
                                this.currDirection)
                                .scale(movementScaleFactor);

                cam.position.addInPlace(deltaPos);
            }
        });
    }


    private backforth = () => {
        const cam = this.cameraManager.getCamera();
        const movementScaleFactor = 0.005;  // Affects movement speed
        const changeDirectionInterval = 3;  // In seconds

        this.currDirection = Vector3.Backward();  // Start moving left
        
        // This function runs before the scene renders (per engine's rendering fps)
        this.scene.onBeforeRenderObservable.add(() => {

            // Check if interval time has passed
            const currPlaybackTime = this.playbackManager.getCurrentPlaybackTime();
            if ((currPlaybackTime - this.prevDirectionUpdateTime) > changeDirectionInterval) {
                
                // Toggle direction
                if (this.currDirection?.equals(Vector3.Backward())) this.currDirection = Vector3.Forward();
                else this.currDirection = Vector3.Backward();
                
                this.prevDirectionUpdateTime = currPlaybackTime;
            }

            // Update camera position
            if (this.currDirection && !this.playbackManager.isPlayerStalling() && !this.playbackManager.isPlaybackEnded()) {
                const deltaPos = cam.getDirection(
                                this.currDirection)
                                .scale(movementScaleFactor);

                cam.position.addInPlace(deltaPos);
            }
        });
    }


    private leftonly = () => {
        const cam = this.cameraManager.getCamera();
        const movementScaleFactor = 0.002;  // Affects movement speed
        // const movementScaleFactor = 0.001;  // LeftOnly_slower
        // const movementScaleFactor = 0.004;  // LeftOnly_faster

        this.currDirection = Vector3.Left();  // Start moving left
        
        // This function runs before the scene renders (per engine's rendering fps)
        this.scene.onBeforeRenderObservable.add(() => {

            // Update camera position
            if (this.currDirection && !this.playbackManager.isPlayerStalling() && !this.playbackManager.isPlaybackEnded()) {
                const deltaPos = cam.getDirection(
                                this.currDirection)
                                .scale(movementScaleFactor);

                cam.position.addInPlace(deltaPos);
            }
        });
    }


    private leftonlynonlinear = () => {
        const cam = this.cameraManager.getCamera();
        const movementScaleFactors = [0.005, 0.001];  // Affects movement speed
        const endSpeedIntervals = [4, 99];  // In seconds
        let counterIndex = 0;

        this.currDirection = Vector3.Left();  // Start moving left
        
        // This function runs before the scene renders (per engine's rendering fps)
        this.scene.onBeforeRenderObservable.add(() => {

            let movementScaleFactor = movementScaleFactors[counterIndex];
            let nextInterval = endSpeedIntervals[counterIndex];
            if (this.playbackManager.getCurrentPlaybackTime() > nextInterval) {
                counterIndex += 1;
            }

            // Update camera position
            if (this.currDirection && !this.playbackManager.isPlayerStalling() && !this.playbackManager.isPlaybackEnded()) {
                const deltaPos = cam.getDirection(
                                this.currDirection)
                                .scale(movementScaleFactor);

                cam.position.addInPlace(deltaPos);
            }
        });
    }

    private leftrightleft = () => {
        const cam = this.cameraManager.getCamera();
        const movementScaleFactor = 0.003;  // Affects movement speed
        const changeDirectionIntervalOnLeft = 8;  // In seconds
        const changeDirectionIntervalOnRight = 0.2; // In seconds

        this.currDirection = Vector3.Left();  // Start moving left
        
        // This function runs before the scene renders (per engine's rendering fps)
        this.scene.onBeforeRenderObservable.add(() => {

            // Set interval based on current direction
            let changeDirectionInterval;
            if (this.currDirection?.equals(Vector3.Left())) changeDirectionInterval = changeDirectionIntervalOnLeft;
            else changeDirectionInterval = changeDirectionIntervalOnRight;

            // Check if interval time has passed
            const currPlaybackTime = this.playbackManager.getCurrentPlaybackTime();
            if ((currPlaybackTime - this.prevDirectionUpdateTime) > changeDirectionInterval) {
                
                // Toggle direction
                if (this.currDirection?.equals(Vector3.Left())) this.currDirection = Vector3.Right();
                else this.currDirection = Vector3.Left();
                
                this.prevDirectionUpdateTime = currPlaybackTime;
            }

            // Update camera position
            if (this.currDirection && !this.playbackManager.isPlayerStalling() && !this.playbackManager.isPlaybackEnded()) {
                const deltaPos = cam.getDirection(
                                this.currDirection)
                                .scale(movementScaleFactor);

                cam.position.addInPlace(deltaPos);
            }
        });
    }

}