/* Babylon Museum
 * Author: Luc Billaud <luc.billaud@insa-lyon.fr>
 * License: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
 * 
 * Sample adapted from Evan Suma Rosenberg <suma@umn.edu> and Blair MacIntyre <blair@cc.gatech.edu> 's tutorial at IEEEVR2021
 * Find it on Github: Web-Based-VR-Tutorial Project Template
 */

import {AssetsManager, Engine, Scene, Tools, ScenePerformancePriority} from "@babylonjs/core";
import {UniversalCamera} from "@babylonjs/core/Cameras";
import {DirectionalLight, HemisphericLight, ShadowGenerator} from "@babylonjs/core/Lights";
import {WebXRCamera, WebXRControllerComponent, WebXRDefaultExperience, WebXRInputSource} from "@babylonjs/core/XR";
import {Axis, Color3, Quaternion, Vector3} from "@babylonjs/core/Maths";
import {PBRMaterial, RenderTargetTexture, StandardMaterial} from "@babylonjs/core/Materials";
import {Mesh, MeshBuilder, TransformNode} from "@babylonjs/core/Meshes";
import {Button3D, GUI3DManager, MeshButton3D, StackPanel3D, TextBlock} from "@babylonjs/gui";

// Side effects
import "@babylonjs/core/Helpers/sceneHelpers";
// Add this to import the controller models from the online repository
import "@babylonjs/loaders"
// More necessary side effects
import "@babylonjs/inspector";

import ObjectManager from './object_manager';
import CameraManager, {VpStrategyChoice} from './camera_manager';
import StrategyManager, {ChooseStrategy} from "./strategy_manager";
import AbrManager, {AbrSegmentInput, StrategyChoice} from "./abr_manager";
import Metrics, {ChooseMetric} from "./metrics";
import Utils from "./game_utils";
import BufferManager from "./buffer_manager";
import DownloadManager from "./download_manager";
import PlaybackManager from "./playback_manager";
import RouteManager, {RouteChoice} from "./route_manager";
import StatsLogger from "./stats_logger";



/**
 * Defines a teleportation point
 */
interface TPPoint {
    id: string,
    name: string,
    x: number,
    y: number,
    z: number
}

/**
 * Main class.
 * Entry point of the game.
 */
class DMeshScene
{
    private cameraManager: CameraManager;
    private strategyManager: StrategyManager;
    private abrManager: AbrManager;
    private playbackManager: PlaybackManager;
    private downloadManager: DownloadManager;
    private routeManager: RouteManager;
    private canvas: HTMLCanvasElement;                  // The HTML page's canvas where the app is drawn
    private engine: Engine;                             // The game engine
    private scene: Scene;                               // The scene where the elements are placed

    private shadowGenerator: ShadowGenerator | null;
    
    private camera: UniversalCamera | null;             // Desktop-mode camera
    private xrCamera: WebXRCamera | null;               // XR-mode camera
    private leftController: WebXRInputSource | null;    // XR left controller
    private rightController: WebXRInputSource | null;   // XR right controller

    private importOn: boolean;                          // Flag indicating if we import the LoDs or not
    private objectManager: ObjectManager;              // The game's object manager
    private tp_points: Array<TPPoint>;                  // The array of the teleportation points
    private importButton: Button3D | undefined;
    private stratButton: Button3D | undefined;
    private metricsButton: Button3D | undefined;


    /* *********************************************
     * Key run params to be set here
     * *********************************************/
    
    // private initStrategy = StrategyChoice.FromFileInput;
    // private initStrategy = StrategyChoice.HighestQuality;
    // private initStrategy = StrategyChoice.CustomQuality;

    // private initStrategy = StrategyChoice.Uniform_2;        // VDH paper
    private initStrategy = StrategyChoice.Greedy_2;     // VDH paper
    // private initStrategy = StrategyChoice.Bola_1;

    private initMetric = ChooseMetric.Distance;
    
    private initRoute = RouteChoice.Manual;
    // private initRoute = RouteChoice.BackForth;
    // private initRoute = RouteChoice.LeftRight;
    // private initRoute = RouteChoice.LeftOnly;
    // private initRoute = RouteChoice.LeftOnlyNonLinear;
    // private initRoute = RouteChoice.LeftRightLeft;

    private initVpStrategy = VpStrategyChoice.None;
    // private initVpStrategy = VpStrategyChoice.LinearPredictor;
    // private initVpStrategy = VpStrategyChoice.LinearRegression;
    // private initVpStrategy = VpStrategyChoice.WeightedLinearRegression;


    /**
     * Creates a DMeshScene instance
     */
    constructor(utils: Utils,
                objectManager: ObjectManager,
                strategyManager: StrategyManager,
                abrManager: AbrManager,
                playbackManager: PlaybackManager,
                downloadManager: DownloadManager,
                cameraManager: CameraManager,
                routeManager: RouteManager) {
        
        this.objectManager = objectManager;
        this.strategyManager = strategyManager;
        this.abrManager = abrManager;
        this.playbackManager = playbackManager;
        this.downloadManager = downloadManager;
        this.cameraManager = cameraManager;
        this.routeManager = routeManager;
        
        this.canvas = utils.canvas;
        this.engine = utils.engine;
        this.scene = utils.scene;   

        this.scene.useRightHandedSystem = true;

        // The Shadow Generator
        this.shadowGenerator = null;

        // Initialize XR camera and controller member variables
        this.camera = null;
        this.xrCamera = null;
        this.leftController = null;
        this.rightController = null;

        // Initialize the managers 
        this.importOn = false;
    
        this.tp_points = [
            {
                id: "main_room",
                name: "Main Room",
                x: 0,
                y: 1.9,
                z: 0
            },
            {
                id: "american_history_room",
                name: "American History Room",
                x: 9,
                y: 1.9,
                z: 7
            },
            {
                id: "statue_room",
                name: "Statue Room",
                x: 9,
                y: 1.9,
                z: -7
            },
            {
                id: "fossils_room",
                name: "Fossils Room",
                x: -12,
                y: 6.9,
                z: 10
            },
            {
                id: "animals_room",
                name: "Animals Room",
                x: -12,
                y: 6.9,
                z: -10
            }
        ];
    }

    /**
     * Create the scene and start the game
     */
    start(): void {
        // Create the scene
        this.initializeScene().then(() => {
            // Try reducing memory usage
            // this.engine.enableOfflineSupport = false;
            // this.engine.doNotHandleContextLost = true;
            
            // Try speeding up (potentially at the cost of memeory)
            // this.scene.performancePriority = ScenePerformancePriority.Aggressive;

            // Debugging..
            console.log(`this.engine.webGLVersion: ${this.engine.webGLVersion}`);
            console.log('Printing testResults..');
            console.log((window as any).testResults);

            // Register a render loop to repeatedly render the scene
            this.engine.runRenderLoop(() => {
                // Move and import LoDs
                this.update();

                // Render the scene
                this.scene.render();
            });

            // Catching browser/canvas resize events
            window.addEventListener("resize", () => { 
                this.engine.resize();
            });

            // Scene done loading here.. Dispatch event for test script
            window.dispatchEvent(new Event("sceneInitialize"));
        });
    }
    
    // ================================================================
    // ===                   PRIVATE METHODS                        ===
    // ================================================================

    /**
     * Create the scene and initialize the project
     */
    private initializeScene = async () => {
        // Create elements needed for the game 
        this.createCamera();
        await this.createXR();

        // Scene elements
        this.createLightings();
        this.createBoundaries();

        // this.createButtons();
        this.createOverlayPlayBtn();

        if (this.initStrategy == StrategyChoice.FromFileInput) {
            const abrFileInputStr = await this.loadFileAsStringAsync(
                                    "./assets/abrFileInput/1702635410_statsBySegment__demo1.json");
            this.abrManager.setAbrFileInput(JSON.parse(abrFileInputStr) as AbrSegmentInput[]);
        }

        // Initializing the object manager to ba able to import objects
        await this.objectManager._init_();
        // await this.loadInterior();
    
        // Show the debug scene explorer and object inspector
        // this.scene.debugLayer.show();
    }

    /**
     * Initialize and configure the desktop camera
     */
    private createCamera = (): void => {
        // This creates and positions a first-person camera (non-mesh)
        // this.camera = new UniversalCamera("DesktopCamera", new Vector3(0, 1.9, 0), this.scene);
        this.camera = new UniversalCamera("DesktopCamera", new Vector3(0.6, 1.9, -0.9), this.scene);

        // This sets the camera direction
        this.camera.setTarget(new Vector3(-1, 1.9, 0));

        // This attaches the camera to the canvas
        this.camera.attachControl(this.canvas, true);

        // Walking speed
        this.camera.speed = 0.15;

        // Set gravity and collisions to walk
        this.scene.gravity = new Vector3(0, -0.05, 0);
        this.scene.collisionsEnabled = true;

        this.camera.applyGravity = true;
        this.camera.checkCollisions = true;

        // Set width and height of our character
        this.camera.ellipsoid = new Vector3(0.5, 1.5, 0.5);
        this.camera.ellipsoidOffset = new Vector3(0, 1, 0); 

        // Setting the distance with the near plane so that we don't see through the walls
        this.camera.minZ = 0.25;
    }

    /**
     * Create Lights in our scene
     */
    private createLightings = (): void => {
        const lightContainer = new TransformNode("LIGHTS", this.scene);

        // Add some lights to the scene
        const ambientlight = new HemisphericLight("ambient", new Vector3(0, 1, 0), this.scene);
        ambientlight.parent = lightContainer;
        ambientlight.intensity = 1.5;
        ambientlight.diffuse = new Color3(1, 1, 1);
    }

    /**
     * Initialize the XR-mode
     */
    private createXR = async () => {
        let xrHelper: WebXRDefaultExperience | null;
        try {
            // Initialize WebXR
            xrHelper = await this.scene.createDefaultXRExperienceAsync({ });
            
            // Disable default teleportation
            xrHelper.teleportation.dispose();
    
            // Assigns the web XR camera to a member variable
            this.xrCamera = xrHelper.baseExperience.camera;

            // Assign the left and right controllers to member variables
            xrHelper.input.onControllerAddedObservable.add((inputSource) => {
                
                if(inputSource.uniqueId.endsWith("left")) {
                    this.leftController = inputSource;
                }
                else {
                    this.rightController = inputSource;
                }  
            });
        }
        catch (e) {
            console.error(e);
        }
    }

    /**
     * Create planes to walk on (+ walls)
     */
    private createBoundaries = (): void => {
        /*
        I create grounds and boxes here to handle collisions in desktop mode.
        The meshes from the gltf (the museum) are either too complex (too many faces)
        or oriented in the wrong direction (normals pointing outside). Hence, the collisions
        are not what I expected (e.g.: going through the floor)
        */
        const container = new TransformNode("BOUNDARIES", this.scene);

        const mat = new StandardMaterial("groundMat", this.scene);
        // mat.diffuseColor = new Color3(0.8, 0.8, 0.8);  // white
        mat.diffuseColor = new Color3(0, 0, 0);  // black
        mat.backFaceCulling = false;

        const ToRad = Math.PI / 180;

        // Ground
        let ground = MeshBuilder.CreateGround("ground", {width: 36, height: 34}, this.scene);
        ground.parent = container;
        ground.position = new Vector3(-1, -0.101, 5);
        ground.material = mat;
        ground.checkCollisions = true;
    }

    /**
     * Create the teleportation crystals and main button
     */
    private createButtons = (): void => {
        const guiManager = new GUI3DManager(this.scene);

        // Import objects Button
        const panel = new StackPanel3D(true);
        panel.margin = 0.02;
        guiManager.addControl(panel);

        panel.position = new Vector3(1.5, 2, 4);
        panel.scaling = new Vector3(-0.5, 0.5, 0.5);


        /**
         * Playback WITH start button
         */
        this.importButton = new Button3D("importObjects");
        const importText = new TextBlock();
        importText.text = "Start";
        importText.color = "cyan";
        importText.fontSize = 42;
        this.importButton.content = importText;
        this.importButton.onPointerUpObservable.add(() => {
            // this.toggleImport();
            this.beginPlaybackWithAbr();
        });
        panel.addControl(this.importButton);

        /**
         * Playback W/O start button
         */
        // this.beginPlaybackWithAbr();

        
        // Selector : Metrics
        this.metricsButton = new Button3D("metricsButton");
        
        const textMetrics = new TextBlock();
        textMetrics.text = "Metric : \nDistance";
        textMetrics.color = "white";
        textMetrics.fontSize = 36;

        this.metricsButton.content = textMetrics;
        this.metricsButton.onPointerUpObservable.add(() => {
            this.cycleMetrics(textMetrics);
        });   

        panel.addControl(this.metricsButton);
        

        // Selector : this.strategyManager
        this.stratButton = new Button3D("stratButton");
        
        const textStrat = new TextBlock();
        textStrat.text = "Strategy : \nRandom1";
        // textStrat.text = "Strategy : \n" + this.abrManager.getStrategyAsString(this.abrManager.getChosenStrategy());
        textStrat.color = "white";
        textStrat.fontSize = 36;

        this.stratButton.content = textStrat;
        this.stratButton.onPointerUpObservable.add(() => {
            this.cycleStrats(textStrat);
        });   

        panel.addControl(this.stratButton);
    }

    /**
     * Import the museum from gltf
     */
    private async loadInterior(): Promise<void> {
        // The assets manager can be used to load multiple assets
        const assetsManager = new AssetsManager(this.scene);

        // Load a GLB file of an entire scene exported from Unity
        const worldTask = assetsManager.addMeshTask("world task", "", "assets/museum/", "Museum.gltf");
        worldTask.onSuccess = async (): Promise<void> => {
            worldTask.loadedMeshes[0].name = "DMeshScene";
            worldTask.loadedMeshes[0].position = new Vector3(1, -0.5, 4);

            if (this.shadowGenerator) this.shadowGenerator.addShadowCaster(worldTask.loadedMeshes[0], true);

            worldTask.loadedMeshes.forEach((msh) => {
                if (msh instanceof Mesh) {
                    msh.receiveShadows = true;
                }
            });
        };

        // This loads all the assets and displays a loading screen
        await assetsManager.loadAsync();

        // This will execute when all assets are loaded
        let wall_mat = this.scene.getMaterialByName("Cyberpunk_5") as PBRMaterial;
        wall_mat.disableBumpMap = true;
        wall_mat.sheen.isEnabled = true;

        let stairs = this.scene.getMeshByName("stair_primitive0");
        if (stairs) stairs.isPickable = false;
    }

    /**
     * The main update loop.  
     * Will be executed once per frame before the scene is rendered
     */
    private update = (): void => {
        // Catch the controllers' inputs (thumbsticks = movement, X & A = toggle import)
        this.onThumbstick(this.leftController?.motionController?.getComponent("xr-standard-thumbstick"));
        this.onButton(this.leftController?.motionController?.getComponent("x-button"));

        this.onThumbstick(this.rightController?.motionController?.getComponent("xr-standard-thumbstick"));
        this.onButton(this.rightController?.motionController?.getComponent("a-button"));
        
    }

    /**
     * Toggle the import flag.  
     * If true, we import the objects.
     */
    private toggleImport = (): void => {
        if (!this.importOn) {
            this.importOn = true;
            this.stratButton?.onPointerUpObservable.clear();
            this.metricsButton?.onPointerUpObservable.clear();
            (this.stratButton?.content as TextBlock).color = "red";
            (this.metricsButton?.content as TextBlock).color = "red";
        }
        else {
            this.importOn = false;
            this.stratButton?.onPointerUpObservable.add(() => {
                this.cycleStrats(this.stratButton?.content as TextBlock);
            });
            this.metricsButton?.onPointerUpObservable.add(() => {
                this.cycleMetrics(this.metricsButton?.content as TextBlock);
            });
            (this.stratButton?.content as TextBlock).color = "white";
            (this.metricsButton?.content as TextBlock).color = "white";
        }
    }

    private beginPlaybackWithAbr = (): void => {
        // Begin ABR, download, and playback
        // (Note: Playback is different from render loop ..
        // .. Playback is about updating the mesh on-scene, render is about the user view)
        // this.abrManager.executeStrategy();
        
        this.downloadManager.beginSegmentRetrieval();
        this.playbackManager.beginPlayback();
        this.routeManager.moveCameraOnChosenRoute();
        // this.playbackManager.beginPlayback(); // Moved to downloadManager > bufferManager

        setInterval(logStats, 100);
        function logStats() {
            StatsLogger.logStatsByTimeInterval();
        }

        // To be checked..
        this.stratButton?.onPointerUpObservable.clear();
        this.metricsButton?.onPointerUpObservable.clear();
        // (this.stratButton?.content as TextBlock).color = "red";
        // (this.metricsButton?.content as TextBlock).color = "red";
    }

    
    private cycleStrats(textB : TextBlock) {   
        switch(this.abrManager.getChosenStrategy()) {
            case StrategyChoice.Random_1: 
                this.abrManager.setStrategy(StrategyChoice.Random_1);
                textB.text = "Strategy : \nRandom1";
                // textB.text = "Strategy : \n" + this.abrManager.getStrategyAsString(StrategyChoice.Random_1);
            // break
            case StrategyChoice.Greedy_2: 
                this.abrManager.setStrategy(StrategyChoice.Greedy_2);
                textB.text = "Strategy : \nGreedy2";
                // textB.text = "Strategy : \n" + this.abrManager.getStrategyAsString(StrategyChoice.Greedy_2);
            break
        }
    }
    

    /**
     * Selects the next Strategy
     * @param textB The strategy button's text block to write current strat
     */
    private cycleMetrics(textB : TextBlock) {   
        switch(Metrics.getChosenMetric()) {
            case ChooseMetric.Distance: 
                Metrics.setMetric(ChooseMetric.Surface);
                textB.text = "Metric : \nSurface";
            break
            case ChooseMetric.Surface: 
                Metrics.setMetric(ChooseMetric.Visible);
                textB.text = "Metric : \nVisible";
            break
            case ChooseMetric.Visible: 
                Metrics.setMetric(ChooseMetric.Potential);
                textB.text = "Metric : \nPotential";
            break
            case ChooseMetric.Potential: 
                Metrics.setMetric(ChooseMetric.Visible_Potential);
                textB.text = "Metric : \nVisible -\nPotential";
            break
            case ChooseMetric.Visible_Potential: 
                Metrics.setMetric(ChooseMetric.Distance);
                textB.text = "Metric : \nDistance";
            break
        }
    }

    /**
     * On X or A press, toggle the animation
     * @param component The left controller's 'X' button or the right controller's 'A' button
     */
    private onButton = (component?: WebXRControllerComponent): void => {
        if (component?.changes.pressed) {
            if (component?.pressed) {
                // this.toggleImport();
                this.beginPlaybackWithAbr();
            }
        }
    }


    // This replaces the in-scene buttons in the Museum application
    private createOverlayPlayBtn = (): void => {
        // Set up run params in overlay text
        const strategyTxt = document.getElementById("overlayStrategy") as HTMLDivElement | null;
        const metricTxt = document.getElementById("overlayMetric") as HTMLDivElement | null;
        const routeTxt = document.getElementById("overlayRoute") as HTMLDivElement | null;
        const vpStrategyTxt = document.getElementById("overlayVpStrategy") as HTMLDivElement | null;

        if (strategyTxt) strategyTxt.innerHTML = this.abrManager.getStrategyAsString(this.initStrategy);  // For ABR
        if (metricTxt) metricTxt.innerHTML = Metrics.getMetricAsString(this.initMetric);
        if (routeTxt) routeTxt.innerHTML = this.routeManager.getRouteAsString(this.initRoute);
        if (vpStrategyTxt) vpStrategyTxt.innerHTML = this.cameraManager.getVpStrategyAsString(this.initVpStrategy);  // For viewport prediction

        // Set up play button
        const playBtn = document.getElementById("overlayPlayBtn") as HTMLDivElement | null;
        if (playBtn) {
            playBtn.style.display = "block";  // Display button

            // Add onclick function
            playBtn.addEventListener('click', () => {
                playBtn.style.color = "gray";  // Turn text gray to signal user click

                // Set run params (e.g. strategy, metric, route)
                this.abrManager.setStrategy(this.initStrategy);
                Metrics.setMetric(this.initMetric);
                this.routeManager.setRoute(this.initRoute);
                this.cameraManager.setVpStrategy(this.initVpStrategy);

                // Begin playback
                this.beginPlaybackWithAbr();
            });
        }
    }


    /**
     * When we move the thumbstick, move the camera
     * @param component The left or right controller's thumbstick
     */
    private onThumbstick = (component?: WebXRControllerComponent): void => {
        if(component?.changes.axes)
        {
            // If thumbstick crosses the turn threshold to the right
            if(component.changes.axes.current.x > 0.75 && component.changes.axes.previous.x <= 0.75)
            {
                // Snap turn by 22.5 degrees
                const cameraRotation = Quaternion.FromEulerAngles(0, -22.5 * Math.PI / 180, 0);
                this.xrCamera!.rotationQuaternion.multiplyInPlace(cameraRotation);
                console.log("turn right");
            }

            // If thumbstick crosses the turn threshold to the left
            if(component.changes.axes.current.x < -0.75 && component.changes.axes.previous.x >= -0.75)
            {
                // Snap turn by -22.5 degrees
                const cameraRotation = Quaternion.FromEulerAngles(0, 22.5 * Math.PI / 180, 0);
                this.xrCamera!.rotationQuaternion.multiplyInPlace(cameraRotation);
                console.log("turn left");
            }

        }

        // Forward locomotion, deadzone of 0.5
        if(component?.axes.y! > 0.5 || component?.axes.y! < -0.5)
        {
            // Get the current camera direction
            const directionVector = this.xrCamera!.getDirection(Axis.Z);
            
            // Restrict vertical movement
            const newDir = new Vector3(directionVector.x, 0, directionVector.z);

            // Use delta time to calculate the move distance based on speed of 3 m/sec
            const moveDistance = -component!.axes.y * (this.engine.getDeltaTime() / 1000) * 3;

            // Translate the camera forward
            this.xrCamera!.position.addInPlace(newDir.scale(moveDistance));
        }
    }

    
    /**
     * Promise to load a file (asynchronously then) as a string
     * @param url The URL to the file to be downloaded
     */
    // Todo - Move common functions to utility file
    private loadFileAsStringAsync = (url: string): Promise<string> => {
        return new Promise<string>(function (resolve, reject) {
            Tools.LoadFile(url, function(data) {
                if (typeof(data) == 'string') {
                    resolve(data);
                }
                else {
                    reject("Requested data was an ArrayBuffer");
                }
            }, undefined, undefined, false, function (req, ex) {
                reject(ex);
            });
        });
    }

}
/******* End of the DMeshScene class ******/   


const initializeManagers = () => {
    const utils = new Utils();
    const objectContainer = new TransformNode("OBJECTS", utils.scene);
    const objectManager = new ObjectManager(utils, null, objectContainer);
    const cameraManager = new CameraManager(utils);
    // const routeManager = new RouteManager(cameraManager, utils.scene);
    // const playbackManager = new PlaybackManager(utils, objectManager, routeManager, cameraManager);
    const playbackManager = new PlaybackManager(utils, objectManager, cameraManager);
    const routeManager = new RouteManager(cameraManager, playbackManager, utils.scene);
    const bufferManager = new BufferManager(objectManager, playbackManager);
    const abrManager = new AbrManager(utils, objectManager, cameraManager, playbackManager);
    const downloadManager = new DownloadManager(utils, bufferManager, objectManager, abrManager, cameraManager, playbackManager);
    const strategyManager = new StrategyManager(cameraManager, downloadManager, objectManager);
    const dmeshScene = new DMeshScene(utils, objectManager, strategyManager, abrManager, playbackManager, downloadManager, cameraManager, routeManager);

    // TODO - Is this deviation from the above design pattern ok?
    StatsLogger.cameraManager = cameraManager;
    StatsLogger.abrManager = abrManager;
    StatsLogger.playbackManager = playbackManager;
    StatsLogger.routeManager = routeManager;
    StatsLogger.utils = utils;

    return dmeshScene;
}

// start the scene
const dmesh_scene = initializeManagers();
dmesh_scene.start();