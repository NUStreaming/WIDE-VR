import { Engine, Scene } from "@babylonjs/core";

/**
 * Singleton creating the canvas, engine and scene
 */
export default class Utils {
    public canvas: HTMLCanvasElement;                  // The HTML page's canvas where the app is drawn
    public engine: Engine;                             // The game engine
    public scene: Scene;                               // The scene where the elements are placed


    /* *********************************************
     * Key run params to be set here
     * *********************************************/
    public includeTexture: boolean = true;
    public captureScreenshot: boolean = false;

    // public serverIp: string = "192.168.1.16"
    // public serverIp: string = "localhost"

    // public serverIp: string = "127.0.0.1"
    public serverIp: string = "192.168.68.69" // Ubuntu nginx


    public constructor() {
        // Get the canvas element 
        this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

        // Generate the BABYLON 3D engine
        if (!this.captureScreenshot) {
            this.engine = new Engine(this.canvas, true, {disableWebGL2Support:true}); 
        } else {
            this.engine = new Engine(this.canvas, true, {disableWebGL2Support:true, preserveDrawingBuffer: true, stencil: true});
        }

        // // Generate the BABYLON 3D engine with WebGL2 support (seems slower than WebGL1..)
        // if (!this.captureScreenshot) {
        //     this.engine = new Engine(this.canvas, true); 
        // } else {
        //     this.engine = new Engine(this.canvas, true, {preserveDrawingBuffer: true, stencil: true});
        // }

        // Creates a basic Babylon Scene object
        this.scene = new Scene(this.engine);   
    }
}
