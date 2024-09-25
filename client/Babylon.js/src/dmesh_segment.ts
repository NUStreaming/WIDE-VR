import {VertexData} from "@babylonjs/core/Meshes";
import {PBRMaterial} from "@babylonjs/core/Materials";


export default class DMeshSegment {
    public rawGeometryData: ArrayBuffer;
    public decodedGeometryData: VertexData | undefined = new VertexData();  // TODO: try deleting and test
    public textureData: PBRMaterial;

    public rawTextureData: ArrayBuffer | null; // &&&&&&&&&&&&&&& testing

    // Optional params mostly for logging purposes
    public segmentId?: string;
    public utility?: number;
    public geometryResUrl?: string;
    public textureResUrl?: string;
    public geometryQuality?: number;
    public textureQuality?: number;
    public geometrySize?: number;
    public textureSize?: number;
    public textureWidth?: number;
    public textureHeight?: number;

    constructor(
        rawGeometryData: ArrayBuffer,
        textureData: PBRMaterial,
        rawTextureData: ArrayBuffer | null // &&&&&&&&&&&&&&& testing
    ) {
        this.rawGeometryData = rawGeometryData;
        this.textureData = textureData;
        this.rawTextureData = rawTextureData; // &&&&&&&&&&&&&&& testing
    }
}