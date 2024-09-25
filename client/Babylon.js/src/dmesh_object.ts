import { Scene, Tools, Vector3, RawTexture } from "@babylonjs/core";
import { PBRMaterial, Texture } from "@babylonjs/core/Materials";
import { DracoCompression, TransformNode, Mesh, Geometry, VertexData } from "@babylonjs/core/Meshes";

import Utils from "./game_utils";
import SpeedManager from "./speed_manager";
import DMeshSegment from "./dmesh_segment";

/**
 * Structure of the data in the metadata.json files
 */
interface MetadataStruct{ 
    name: string;
    nb_levels: number; 
    nb_textures: number; 
    nb_frames: number;
    area: number;

    Levels: Array<{
        level: number;
        filename: string;
        size: number;
        hdrvdp2: number;
    }>;

    Textures: Array<{
        level: number;
        filename: string;
        size: number;
        hdrvdp2: number;
    }>;
}

/**
 * Class representing one object in the scene.  
 * Contains the metadata and the LoDs
 */
export default class DMeshObject {
    public scene: Scene;                           // The scene
    private draco: DracoCompression;                // Draco object used to decompress the object (may be shared between the dmesh objects)
    private metadata: MetadataStruct | undefined;   // Imported at beginning from metadata.json, contains offline info
    private folderPath : string | null;             // Path to the folder containing the metadata, the levels and the texture

    private position: Vector3;                      // Position of the object in the scene
    private rotation: Vector3;                      // Rotation of the object in the scene
    private scale: Vector3;                         // Scale coefficient

    private material: PBRMaterial | undefined;      // Material of the object, contains the right texture
    public container: TransformNode | undefined;    // Node containing the meshes

    public currentLevel: number;                    // LOD currently displayed
    private levels: Array<Mesh> | undefined;        // Array of the LODs
    private asked: Array<boolean> | undefined;      // Array of booleans corresponding to if the LoD have been requested

    private buffer: Array<DMeshSegment>;

    public rawTexture: RawTexture; // &&&&&&&&&&&&&&&&& testing
    public material2: PBRMaterial;

    /**
     * Creates a DMeshObject
     * @param pDraco The Draco object to decompress the LoDs. If null, we create one.
     * @param pFolderPath The path to the object's asset folder
     * @param pPosition The position of the object
     * @param pRotation The rotation of the object
     * @param pScale The scaling factor of the object
     */
    constructor(scene: Scene,
                // pDraco: DracoCompression | null,
                pDraco: DracoCompression,
                pFolderPath: string | null, 
                pPosition: Vector3,
                pRotation: Vector3,
                pScale: Vector3) {
        this.scene = scene;
        this.draco = (pDraco) ? pDraco : new DracoCompression(1);   // Testing only, now we have a shared DracoCompression (null parameter means each DMeshObject has an instance of DracoCompression)
        this.folderPath = pFolderPath;

        this.position = pPosition;
        this.rotation = pRotation;
        this.scale = pScale;

        this.currentLevel = -1;

        this.buffer = [];

        // &&&&&&&&&&&&&&&&&&&&&&&&&&&&& testing
        // https://forum.babylonjs.com/t/texture-loading-blocks-thread/19411/2
        // https://playground.babylonjs.com/#YDO1F#664
        this.rawTexture = RawTexture.CreateRGBTexture(null, 2048, 2048, scene);
        this.material2 =  new PBRMaterial(`Material`, scene)
        // this.material2.albedoTexture = this.rawTexture;
    }


    // ================================================================
    // ===                   PUBLIC METHODS                         ===
    // ================================================================

    /**
     * Fetches the metadata and initialize the attributes that depend on those.  
     * Has to be called before using the DMeshObject
     */
    public async _init_(): Promise<void> {
        if (this.folderPath != null) {
            // Fetching the metadata file
            const pMetadata = await this.loadFileAsStringAsync(this.folderPath + "metadata.json");
            
            try {
                // Parsing
                this.metadata = JSON.parse(pMetadata) as MetadataStruct;
            }
            catch (e) {
                throw e;
            }

            // Initializing the attributes with the metadata
            this.levels = new Array(this.metadata.nb_levels);
            this.asked = new Array(this.metadata.nb_levels);

            this.container = new TransformNode(this.metadata.name, this.scene);
            const texture = new Texture(this.folderPath + this.metadata.Textures[0].filename, this.scene);

            // Creating a material shared by all the LoDs of the object
            this.material = new PBRMaterial(this.metadata.name + "Material", this.scene);
            this.material.backFaceCulling = false;
            this.material.albedoTexture = texture;
            this.material.metallicTexture = texture;
            this.material.roughness = 1;
            this.material.metallic = 0.3;
        }
    }

    /**
     * Imports, decompresses and displays a LoD of the object
     * @param level The level to import
     * @returns A promise with the imported mesh
     */
    public import = async (level: number): Promise<Mesh> => {
        // If level is not valid, 
        // the object not initialized 
        // or the LoD has already been asked / downloaded
        //  => exception
        if (!this.levels || !this.asked) {
            throw "Error : DMeshObject not initialized";
        }
        if (level < 0 || level > this.metadata!.nb_levels) {
            throw "Incorrect Level : Out of Bounds";
        }
        if (this.levels[level] || this.asked[level]) {
            throw "Import warn : Level already requested or imported";
        }

        this.asked[level] = true;
        const startimport = performance.now(); // Time before requesting the LoD

        let data;
        try {
            // Fetching the Draco file containing the LoD
            data = await this.loadFileAsArrayBufferAsync(this.folderPath + this.metadata!.Levels[level].filename);
        }
        catch (err) {
            console.error("Import Error", "Problem while fetching the object file");
            throw err;
        }

        const endrequest = performance.now(); // Time after recieving the Draco file
        let vertexData;
        try {
            // Decompressing the data
            vertexData = await this.draco.decodeMeshAsync(data);
        }
        catch (err) {
            console.error("Import Error", "Problem while decompressing the mesh");
            throw err;
        }

        // Creating a mesh that will contain the LoD
        const mesh = new Mesh(this.metadata!.name + level, this.scene, this.container);
        
        // Applying the data that has been decompressed to the mesh
        const geometry = new Geometry("dracoGeometry", this.scene);
        VertexData.ImportVertexData(vertexData, geometry);
        geometry.applyToMesh(mesh);
        
        // Applying the material
        if (this.material) mesh.material = this.material;

        // Positionning, rotating, scaling the mesh
        mesh.position = this.position;
        mesh.rotation = this.rotation;
        mesh.scaling = this.scale;
        mesh.receiveShadows = true;
        mesh.refreshBoundingInfo();
        this.levels[level] = mesh;

        // Display the LoD if it is the highest level downloaded
        //  Otherwise, don't display it
        if (level > this.currentLevel) {
            if (this.currentLevel != -1) this.levels[this.currentLevel].setEnabled(false);
            this.currentLevel = level;
        }
        else {
            this.levels[level].setEnabled(false);
        }

        const endimport = performance.now();  // Time after doing everything
        const bandwidth = this.metadata!.Levels[level].size * 1000 / (endrequest - startimport);
        const dSpeed = this.metadata!.Levels[level].size * 1000 / (endimport - endrequest);

        // Sending the bandwidth and "RTT" to the object manager
        SpeedManager.pushBandwidth(bandwidth);
        SpeedManager.pushDSpeed(dSpeed);

        return mesh;
    }

    /**
     * Get a LoD
     * @param level The level of the LoD required
     * @returns The LoD if it is imported
     */
    public getLevel = (level: number): Mesh | null => {
        if (!this.levels || !this.metadata) {
            throw "Error : DMeshObject not initialized";
        }
        else if (level < 0 || level > this.metadata.nb_levels) {
            throw "Incorrect Level : Out of Bounds";
        }
        else {
            return this.levels[level];
        }
    }

    /**
     * Get the mesh currently displayed
     */
    public getCurrentMesh = (): Mesh => {
        if (!this.levels || !this.metadata) {
            throw "Error : DMeshObject not initialized";
        }
        else if (this.currentLevel == -1) {
            throw "Error : No level yet imported";
        }
        else {
            return this.levels[this.currentLevel];
        }
    }

    /**
     * Get a LoD's size (in kB) - geometry only
     * @param level The level we want to know the size of
     * @returns The size of the LoD (in kB)
     */
    public getLevelSizeGeometry = (level: number): number => {
        if (!this.levels || !this.metadata) {
            throw "Error : DMeshObject not initialized";
        }
        else if (level < 0 || level > this.metadata.nb_levels) {
            throw "Incorrect Level : Out of Bounds";
        }
        else {
            return this.metadata.Levels[level].size;
        }
    }

    /**
     * Get a LoD's size (in kB) - texture only
     * @param level The level we want to know the size of
     * @returns The size of the LoD (in kB)
     */
    public getLevelSizeTexture = (level: number): number => {
        if (!this.levels || !this.metadata) {
            throw "Error : DMeshObject not initialized";
        }
        else if (level < 0 || level > this.metadata.nb_levels) {
            throw "Incorrect Level : Out of Bounds";
        }
        else {
            return this.metadata.Textures[level].size;
        }
    }

    /**
     * Get a LoD's size (in kB) - both geometry and texture
     * @param level The level we want to know the size of
     * @returns The size of the LoD (in kB)
     */
    public getLevelSize = (level: number): number => {
        if (!this.levels || !this.metadata) {
            throw "Error : DMeshObject not initialized";
        }
        else if (level < 0 || level > this.metadata.nb_levels) {
            throw "Incorrect Level : Out of Bounds";
        }
        else {
            return this.getLevelSizeGeometry(level) + this.getLevelSizeTexture(level);
        }
    }
    
    /**
     * Get a LoD's quality
     * @param level The level we want to know the size of
     * @returns The quality of the LoD (in kB)
     */
    public getLevelQuality = (level: number): number => {
        if (!this.levels || !this.metadata) {
            throw "Error : DMeshObject not initialized";
        }
        else if (level < 0 || level > this.metadata.nb_levels) {
            throw "Incorrect Level : Out of Bounds";
        }
        else {
            return 1 - this.metadata.Levels[level].hdrvdp2;
        }
    }

    /**
     * Get the total number of LoDs for this object
     * @returns The number of LoDs for this object
     */
    public getNumberOfLevels = (): number => {
        if (!this.metadata) {
            throw "Error : DMeshObject not initialized";
        }
        else {
            return this.metadata.nb_levels;
        }
    }

    /**
     * Get the total number of frames for this object
     * @returns The number of frames for this object
     */
    public getNumberOfFrames = (): number => {
        if (!this.metadata) {
            throw "Error : DMeshObject not initialized";
        }
        else {
            return this.metadata.nb_frames;
        }
    }

    /**
     * Get an object metadata
     * @returns The object's metadata
     */
    public getMetadata = (): MetadataStruct => {
        if (!this.metadata) {
            throw "Error : DMeshObject not initialized";
        }
        else {
            return this.metadata;
        }
    }

    /**
     * Get an object folder path
     * @returns The object's folder path
     */
    public getFolderPath = (): string => {
        if (!this.folderPath) {
            throw "Error : DMeshObject not initialized";
        }
        else {
            return this.folderPath;
        }
    }

    /**
     * Get an object's position
     * @returns The object's position
     */
    public getPosition = (): Vector3 => {
        return this.position;
    }

    /**
     * Get an object's rotation
     * @returns The object's rotation
     */
    public getRotation = (): Vector3 => {
        return this.rotation;
    }

    /**
     * Get an object's scaling vector (all 3 factors should be equal)
     * @returns The object's scaling vector
     */
    public getScale = (): Vector3 => {
        return this.scale;
    }

    // ================================================================
    // ===                   PRIVATE METHODS                        ===
    // ================================================================

    /**
     * Load a file asynchronously. The data is returned as a string.
     * @param url The url to the file to load
     * @returns A promise containing the file as a string
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

    /**
     * Load a file asynchronously. The data is returned as an array buffer.
     * @param url The url to the file to load
     * @returns A promise containing the file as an array buffer
     */
    private loadFileAsArrayBufferAsync = (url: string): Promise<ArrayBuffer> => {
        return new Promise<ArrayBuffer>(function (resolve, reject) {
            Tools.LoadFile(url, function(data) {
                if (typeof(data) == 'string') {
                    reject("Requested data was a string");
                }
                else {
                    resolve(data);
                }
            }, undefined, undefined, true, function (req, ex) {
                reject(ex);
            });
        });
    }

    /**
     * Add segment to the buffer
     * @param segment
     */
    public addToBuffer = async (segment: DMeshSegment) => {
        const startdecode = performance.now(); // Time before decoding the LoD
        segment.decodedGeometryData = await this.draco.decodeMeshAsync(segment.rawGeometryData);
        const enddecode = performance.now(); // Time after decoding the LoD
        const decodeSpeedKBps = segment.rawGeometryData.byteLength / (enddecode - startdecode);
        SpeedManager.pushDSpeed(decodeSpeedKBps);
        // console.log(`  .. time taken for decoding: ${(enddecode - startdecode)}`)
        // console.log(`  .. decodeSpeedKBps: ${decodeSpeedKBps}`)

        // console.log(`### frameNo: ${segment.segmentId} /onDecodeDraco/ ${performance.now()}`)

        // Update value on UI for debugging
        const decodeDebugTxt = document.getElementById(
            "decodeDebugTxt",
        ) as HTMLDivElement | null;
        if (decodeDebugTxt) decodeDebugTxt.innerHTML = String((enddecode - startdecode).toFixed(2));

        this.buffer.push(segment);
    }

    public getBufferSize = (): number => {
        return this.buffer.length;
    }

    public getBufferAt(frameNo: number){
        return this.buffer[frameNo];
    }
}