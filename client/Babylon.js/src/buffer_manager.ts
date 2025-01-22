import DMeshObject from "./dmesh_object";
import DMeshSegment from "./dmesh_segment";
import ObjectManager from "./object_manager";
import PlaybackManager from "./playback_manager";

export default class BufferManager {
    private objectManager: ObjectManager;
    private playbackManager: PlaybackManager;

    // // private minNecessaryBufferFrames: number = 5; // Maximum number of frames to buffer
    // private minBufferForStartup: number = 1; // Min. buffer (in seconds) before playback begins
    // private minBufferForResume: number = 0.5; // Min. buffer (in seconds) before playback resumes after stalling

    public constructor(objectManager: ObjectManager, playbackManager: PlaybackManager) {
        this.objectManager = objectManager;
        this.playbackManager = playbackManager;
    }

    // public checkBufferSufficientForPlayback = (): boolean => {
    //     const bufferLengths = this.objectManager.getAllObjects().map(dMeshObject => dMeshObject.getBufferSize());
    //     const minBufferLength = Math.min(...bufferLengths);
    //     return minBufferLength >= this.minNecessaryBufferFrames;
    // }

    // private isBufferSufficientForPlayback = (): boolean => {
    //     const minBufferLengthInFrameCount = this.getMinBufferLengthAcrossObjectsInFrameCount();
    //     // return (minBufferLengthInFrameCount >= (this.minBufferForStartup * this.playbackManager.targetPlaybackFps)) 
    //     //         && (minBufferLengthInFrameCount >= (this.playbackManager.nextFrameNoForPlayback + this.minBufferForResume * this.playbackManager.targetPlaybackFps));

    //     // Edge case for playback is when the buffer is at the end of the stream (then we ignore whatever (possibly missed) requirement below)
    //     if (minBufferLengthInFrameCount == this.playbackManager.lastFrameNo)
    //         return true;

    //     // Less than required startup buffer
    //     if (minBufferLengthInFrameCount < (this.minBufferForStartup * this.playbackManager.targetPlaybackFps))
    //         return false;
    //     // More than or equal to required startup buffer but less than required resume buffer
    //     else if (minBufferLengthInFrameCount < (this.playbackManager.nextFrameNoForPlayback + (this.minBufferForResume * this.playbackManager.targetPlaybackFps)))
    //         return false;
    //     else
    //         return true;
    // }

    public getMinBufferLengthAcrossObjectsInFrameCount = (): number => {
        const bufferLengths = this.objectManager.getAllObjects().map(dMeshObject => dMeshObject.getBufferSize());
        return Math.min(...bufferLengths);
    }

    public addSegment = async (obj: DMeshObject, seg: DMeshSegment) => {
        await obj.addToBuffer(seg);
        
        // if (!this.playbackManager.isPlayerStarted() && this.checkBufferSufficientForPlayback()) {
        //     this.playbackManager.play();
        // }

        // if (!this.playbackManager.hasPlaybackStarted && this.playbackManager.isBufferSufficientForPlayback()) {
        //     this.playbackManager.beginPlayback();
        // }
    }
}
