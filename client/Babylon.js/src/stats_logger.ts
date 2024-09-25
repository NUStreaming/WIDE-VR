import DMeshObject from "./dmesh_object";
import DMeshSegment from "./dmesh_segment";
import SpeedManager from "./speed_manager";
import AbrManager from "./abr_manager";
import CameraManager from "./camera_manager";
import PlaybackManager from "./playback_manager";
import RouteManager from "./route_manager";
import Metrics from './metrics';
import {Vector3} from "@babylonjs/core";

/**
 * Utility class to log player statistics
 */
export default class StatsLogger {

    // private static statsBySegment = new Map<string, Map<string, string|number>>();
    // private static statsBySegment = new Map<string, Object>();
    private static statsBySegment = new Array<Object>();
    
    public static cumulativeStall: number = 0;  // in ms
    private static previousCumulativeStall: number = 0;

    public static cameraManager: CameraManager;
    public static abrManager: AbrManager;
    public static playbackManager: PlaybackManager;
    public static routeManager: RouteManager;


    public static logStatsBySegment(dMeshObject: DMeshObject, dMeshSegment: DMeshSegment): void {
        const segmentStats = new Map<string, string|number|undefined>();

        // Add stats to log
        segmentStats.set('objectName', dMeshObject.getMetadata().name);
        segmentStats.set('segmentId', dMeshSegment.segmentId);
        segmentStats.set('utility', dMeshSegment.utility);
        segmentStats.set('geometryResUrl', String(dMeshSegment.geometryResUrl));
        segmentStats.set('textureResUrl', String(dMeshSegment.textureResUrl));
        segmentStats.set('geometryQuality', dMeshSegment.geometryQuality);
        segmentStats.set('textureQuality', dMeshSegment.textureQuality);
        segmentStats.set('geometrySize', dMeshSegment.geometrySize);
        segmentStats.set('textureWidth', dMeshSegment.textureWidth);
        segmentStats.set('textureHeight', dMeshSegment.textureHeight);

        segmentStats.set('objectDistance', Vector3.Distance(dMeshObject.getPosition(), this.cameraManager.getCamera().position));
        segmentStats.set('bandwidthKBps', SpeedManager.getBandwidth());
        segmentStats.set('downloadSpeedKBps', SpeedManager.getDSpeed());
        // segmentStats.set('bufferMs', this.playbackManager.getMinBufferLengthAcrossObjectsInFrameCount() / this.playbackManager.targetPlaybackFps * 1000);
        segmentStats.set('bufferS', this.playbackManager.getCurrentBufferInSeconds());

        segmentStats.set('stallMs', this.cumulativeStall - this.previousCumulativeStall);
        segmentStats.set('cumulativeStallMs', this.cumulativeStall);
        this.previousCumulativeStall = this.cumulativeStall;

        // const segmentKey = `${dMeshSegment.segmentId}_${dMeshObject.getMetadata().name}`;
        // this.statsBySegment.set(segmentKey, Object.fromEntries(segmentStats));
        this.statsBySegment.push(Object.fromEntries(segmentStats));
    }


    public static saveSessionStats(): void {
        const timestamp = Math.trunc(Date.now()/1000);
        this.saveStatsBySegment(timestamp);
        this.saveStatsOverall(timestamp);
    }

    private static saveStatsBySegment(timestamp: number): void {
        // this.saveAsFile(`${timestamp}_statsBySegment.json`, this.statsBySegment);
        (window as any).testResults.byDownload = this.statsBySegment;
    }
    
    private static saveStatsOverall(timestamp: number): void {
        const statsOverall = new Map<string, string|number>();

        // Add stats to log
        statsOverall.set('chosenStrategy', this.abrManager.getChosenStrategyAsString());
        statsOverall.set('chosenMetric', Metrics.getChosenMetricAsString());
        statsOverall.set('chosenCameraRoute', this.routeManager.getChosenRouteAsString());
        statsOverall.set('cumulativeStallMs', this.cumulativeStall);
        statsOverall.set('targetPlaybackFps', this.playbackManager.targetPlaybackFps);
        if (this.playbackManager.endPlaybackTime != null && this.playbackManager.startPlaybackTime != null) {
            const playbackDurationLessStallsSec = (this.playbackManager.endPlaybackTime - this.playbackManager.startPlaybackTime - this.cumulativeStall) / 1000;
            const playbackFrames = (this.playbackManager.nextFrameNoForPlayback - 1);
            statsOverall.set('playbackDurationLessStallsSec', playbackDurationLessStallsSec);
            statsOverall.set('playbackFrames', playbackFrames);
            statsOverall.set('playbackFps', (playbackFrames / playbackDurationLessStallsSec));
        }

        // this.saveAsFile(`${timestamp}_statsOverall.json`, Object.fromEntries(statsOverall));
        (window as any).testResults.overall = Object.fromEntries(statsOverall);
    }

    private static saveAsFile(filename: string, data: Object): void {
        const blob = new Blob([JSON.stringify(data)]);
        const link = document.createElement("a");
        link.download = filename;
        link.href = window.URL.createObjectURL(blob);
        link.click()
    }
}