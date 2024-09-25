import { Camera, FreeCamera, Mesh, Scene, Vector3 } from "@babylonjs/core";

import CameraManager from "./camera_manager";

export enum RouteChoice {
    Manual,
    BackForth,
    LeftRight
}

export default class RouteManager {
    private cameraManager: CameraManager;
    private scene: Scene;

    private _chosenRoute: RouteChoice = RouteChoice.Manual; // The strategy we will execute
    
    private currDirection: Vector3|null = null;
    private prevDirectionUpdateTime: number = 0;

    public constructor(cameraManager: CameraManager, scene: Scene) {
        this.cameraManager = cameraManager;
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
        }
    }

    private backforth = () => {
        const cam = this.cameraManager.getCamera();
        const movementScaleFactor = 0.005;  // Affects movement speed
        const changeDirectionInterval = 3;  // In seconds
        
        // This function runs before the scene renders (per engine's rendering fps)
        this.scene.onBeforeRenderObservable.add(() => {

            // Check if interval time has passed
            const currTime = performance.now();
            if ((currTime - this.prevDirectionUpdateTime) > changeDirectionInterval * 1000) {
                
                // Toggle direction
                if (this.currDirection?.equals(Vector3.Backward())) this.currDirection = Vector3.Forward();
                else this.currDirection = Vector3.Backward();  // Includes the case of first move
                
                this.prevDirectionUpdateTime = currTime;
            }
            
            // Update camera position
            if (this.currDirection) {
                const deltaPos = cam.getDirection(
                                this.currDirection)
                                .scale(movementScaleFactor);

                cam.position.addInPlace(deltaPos);
            }
        });
    }

    private leftright = () => {
        const cam = this.cameraManager.getCamera();
        const movementScaleFactor = 0.005;  // Affects movement speed
        const changeDirectionInterval = 3;  // In seconds
        
        // This function runs before the scene renders (per engine's rendering fps)
        this.scene.onBeforeRenderObservable.add(() => {

            // Check if interval time has passed
            const currTime = performance.now();
            if ((currTime - this.prevDirectionUpdateTime) > changeDirectionInterval * 1000) {
                
                // Toggle direction
                if (this.currDirection?.equals(Vector3.Left())) this.currDirection = Vector3.Right();
                else this.currDirection = Vector3.Left();  // Includes the case of first move
                
                this.prevDirectionUpdateTime = currTime;
            }
            
            // Update camera position
            if (this.currDirection) {
                const deltaPos = cam.getDirection(
                                this.currDirection)
                                .scale(movementScaleFactor);

                cam.position.addInPlace(deltaPos);
            }
        });
    }

}