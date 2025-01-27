import { Camera, Frustum, Quaternion, Tools, Vector3 } from "@babylonjs/core";
import { ShadowGenerator } from "@babylonjs/core/Lights";
import {DracoCompression, Mesh, TransformNode} from "@babylonjs/core/Meshes";

import DMeshObject from './dmesh_object';
import StrategyManager from "./strategy_manager";
import { WebXRCamera } from "@babylonjs/core/XR/webXRCamera";
import Utils from "./game_utils";

/**
 * Structure of the data in the positions.json file
 */
interface ObjectData{ 
    name: string; 
    position: number[]; 
    rotation: number[]; 
    scale: number; 
}

/**
 * Class in charge of creating the MuseumObjects and importing the LoDs
 */
export default class ObjectManager {
    private utils: Utils;
    private shadowGenerator: ShadowGenerator | null;    // If we want to have the object to cast shadows
    private container: TransformNode | undefined;       // The node containing the objects

    private objectsData: ObjectData[] | undefined;      // The data about the objects (position, rotation, scale)  
    public objects: DMeshObject[];                    // The MuseumObjects subsequently created

    public import_started: boolean                      // Used to ensure that we execute our startegy only once at a time
    public initialSceneMeshesLen: number = 0;

    /**
     * Creates an object manager (has to be initialized)
     * @param pShadowGenerator Sun's shadow generator (to cast shadows)
     * @param pContainer The node containing that will contain the objects
     */
    constructor(utils: Utils,
                pShadowGenerator: ShadowGenerator | null,
                pContainer?: TransformNode) {
        this.shadowGenerator = pShadowGenerator;
        this.container = pContainer;

        this.objects = [];

        this.import_started = false;
        this.utils = utils;
    }

    // ================================================================
    // ===                   PUBLIC METHODS                         ===
    // ================================================================

    /**
     * Initialize the object manager  
     * Has to be called before using the object manager
     */
    public _init_ = async () => {
        // Loads the position.json file to initialize the MuseumObjects
        const objData = await this.loadFileAsStringAsync(`https://${this.utils.serverIp}:8443/static/media/vsenseVVDB2/positions.json`);
        // const objData = await this.loadFileAsStringAsync(`https://${this.utils.serverIp}:8443/static/media/vsenseVVDB2_600f/positions.json`);
        this.objectsData = JSON.parse(objData) as ObjectData[];
        const ToRad = Math.PI / 180;

        // Create a shared DracoCompression object
        //  (shared Draco with 5 workers has been the best in my tests)
        const dracocomp = new DracoCompression(5);
        // const dracocomp = new DracoCompression(100);
            
        // Create the MuseumObjects, initialize them and import level 0 (all objects at the same time)
        await Promise.all(this.objectsData.map(async (element: ObjectData) => {
            const pos = new Vector3(element.position[0], element.position[1], element.position[2]);
            const rot = new Vector3(element.rotation[0] * ToRad, element.rotation[1] * ToRad, element.rotation[2] * ToRad);
            const sca = new Vector3(element.scale, element.scale, element.scale);
            
            const importer = new DMeshObject(this.utils.scene, dracocomp, `https://${this.utils.serverIp}:8443/static/media/vsenseVVDB2/` + element.name + "/", pos, rot, sca);
            // const importer = new DMeshObject(this.utils.scene, dracocomp, `https://${this.utils.serverIp}:8443/static/media/vsenseVVDB2_600f/` + element.name + "/", pos, rot, sca);

            this.objects.push(importer);

            await importer._init_();
            if (importer.container && this.container) importer.container.parent = this.container;
        
            // const msh = await importer.import(0);
            const msh = await importer.import(3);   // Import highest level for init frame
            if (msh && this.shadowGenerator) this.shadowGenerator.getShadowMap()!.renderList!.push(msh);
        }));
    }

    /**
     * Imports all objects using a certain strategy
     */
    public anim_import = async (strategyExecuter: () => Promise<Mesh[]>) => {
        if (!this.import_started && !this.checkAllLoaded()) {
            this.import_started = true;
            const meshes = await strategyExecuter();

            if (this.shadowGenerator) {
                for (const mesh of meshes) {
                    this.shadowGenerator.getShadowMap()!.renderList!.push(mesh);
                }
            }

            await this.delay(1);                     // Sans délai, l'objet qui vient d'être importé n'est pas compté dans les objets visibles
            // this.import_started = false;
        }
    }    


    /**
     * Returns all objects seen by the camera
     * @param cam The point of view
     */
    public getVisibleObjects = (cam: Camera): DMeshObject[] => {
        const visibles = this.objects.filter((obj) => { 
            console.log('getVisibleObjects obj:' + obj.getFolderPath());
            console.log('obj.isObjectVisible(cam): ' + obj.isObjectVisible(cam))
            return obj.isObjectVisible(cam);
        });
        return visibles;
    }

    /**
     * Returns all objects not seen by the camera
     * @param cam The point of view
     */
    public getNotVisibleObjects = (cam: Camera): DMeshObject[] => {
        const visibles = this.objects.filter((obj) => { 
            return !(obj.isObjectVisible(cam));
        });
        return visibles;
    }

    /**
     * Returns all the MuseumObjects
     */
    public getAllObjects = (): DMeshObject[] => {
        return this.objects;
    }

    public getMaxNumOfLevelsAcrossObjects = (): number => {
        return Math.max(...this.objects.map(item => item.getNumberOfLevels()));
    }


    // ================================================================
    // ===                   PRIVATE METHODS                        ===
    // ================================================================

    /**
     * Returns true if the max LoD from all objects is downloaded
     */
    private checkAllLoaded = (): boolean => {
        for (let i = 0; i < this.objects.length; i++) {
            const obj = this.objects[i];

            // console.warn(obj.getLevel(obj.getNumberOfLevels() - 1));

            if (!obj.getLevel(obj.getNumberOfLevels() - 1)) return false;
        }
        return true;
    }

    /**
     * Promise to wait for a specified duration
     * @param ms Time in milliseconds to wait
     */
    private delay = (ms: number): Promise<void> => {
        return new Promise(res => setTimeout(res, ms))
    }

    /**
     * Promise to load a file (asynchronously then) as a string
     * @param url The URL to the file to be downloaded
     */
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