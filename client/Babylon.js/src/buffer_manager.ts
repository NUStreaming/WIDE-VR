import DMeshObject from "./dmesh_object";
import DMeshSegment from "./dmesh_segment";
import ObjectManager from "./object_manager";
import PlaybackManager from "./playback_manager";

export default class BufferManager {
    private objectManager: ObjectManager;
    private playbackManager: PlaybackManager;

    public constructor(objectManager: ObjectManager, playbackManager: PlaybackManager) {
        this.objectManager = objectManager;
        this.playbackManager = playbackManager;
    }


    public getMinBufferLengthAcrossObjectsInFrameCount = (): number => {
        const bufferLengths = this.objectManager.getAllObjects().map(dMeshObject => dMeshObject.getBufferSize());
        return Math.min(...bufferLengths);
    }

    public addSegment = async (obj: DMeshObject, seg: DMeshSegment) => {
        await obj.addToBuffer(seg);
    }
}
