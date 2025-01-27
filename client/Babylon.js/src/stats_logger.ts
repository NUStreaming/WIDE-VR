import DMeshObject from "./dmesh_object";
import DMeshSegment from "./dmesh_segment";
import SpeedManager from "./speed_manager";
import AbrManager from "./abr_manager";
import CameraManager from "./camera_manager";
import PlaybackManager from "./playback_manager";
import RouteManager from "./route_manager";
import ObjectManager from "./object_manager";
import Utils from "./game_utils";
import Metrics from './metrics';
import {Vector3, FreeCamera} from "@babylonjs/core";

/**
 * Utility class to log player statistics
 */
export default class StatsLogger {

    // private static statsBySegment = new Map<string, Map<string, string|number>>();
    // private static statsBySegment = new Map<string, Object>();
    private static statsBySegmentOnDownload = new Array<Object>();
    private static statsBySegmentOnPlayback = new Array<Object>();
    private static statsByTimeInterval = new Array<Object>();
    private static statsByVpPrediction = new Array<Object>();

    private static screenshotsCaptured = new Array<Object>();
    
    public static cumulativeStall: number = 0;  // in ms
    private static previousCumulativeStall: number = 0;
    public static numStalls: number = 0;
    public static startupDelay: number = 0; // in ms

    public static cameraManager: CameraManager;
    public static abrManager: AbrManager;
    public static playbackManager: PlaybackManager;
    public static routeManager: RouteManager;
    public static objectManager: ObjectManager;
    public static utils: Utils;


    public static logStatsBySegmentOnDownload(dMeshObject: DMeshObject, dMeshSegment: DMeshSegment): void {
        const segmentStats = new Map<string, string|number|undefined>();

        segmentStats.set('timestampMs', Date.now());
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


        this.statsBySegmentOnDownload.push(Object.fromEntries(segmentStats));
    }

    public static logStatsBySegmentOnPlayback(dMeshObject: DMeshObject, dMeshSegment: DMeshSegment): void {
        const segmentStats = new Map<string, string|number|undefined>();

        segmentStats.set('timestampMs', Date.now());
        segmentStats.set('objectName', dMeshObject.getMetadata().name);
        segmentStats.set('segmentId', dMeshSegment.segmentId);

        segmentStats.set('objectDistance', Vector3.Distance(dMeshObject.getPosition(), this.cameraManager.getCamera().position));

        if (Number(dMeshSegment.segmentId) == 1) segmentStats.set('isObjectVisible', 'null');   // Will not work for first segment (the check uses mesh_t-1 as the mesh needs to be rendered)
        else segmentStats.set('isObjectVisible', dMeshObject.isObjectVisible(this.cameraManager.getCamera()) ? 'true' : 'false');

        segmentStats.set('cameraPosition', this.cameraManager.getCamera().position.toString());
        segmentStats.set('cameraRotation', this.cameraManager.getCamera().rotation.toString());
        
        this.statsBySegmentOnPlayback.push(Object.fromEntries(segmentStats));
    }

    public static logStatsByTimeInterval(): void {
        const segmentStats = new Map<string, string|number|undefined>();
        
        segmentStats.set('timestampMs', Date.now());
        segmentStats.set('bandwidthKBps', SpeedManager.getBandwidth());
        segmentStats.set('downloadSpeedKBps', SpeedManager.getDSpeed());
        segmentStats.set('bufferMs', this.playbackManager.getCurrentBufferInSeconds() * 1000);

        segmentStats.set('stallMs', this.cumulativeStall - this.previousCumulativeStall);
        segmentStats.set('cumulativeStallMs', this.cumulativeStall);
        this.previousCumulativeStall = this.cumulativeStall;

        this.statsByTimeInterval.push(Object.fromEntries(segmentStats));
    }

    public static logStatsByVpPrediction(cameraLater: FreeCamera, visiblesLater: DMeshObject[], positionSamples: Vector3[], rotationSamples: Vector3[], predSegmentNo: number): void {
        const segmentStats = new Map<string, string|number|undefined>();

        segmentStats.set('timestampMs', Date.now());
        segmentStats.set('positionSamples', positionSamples.map(p => p.toString()).toString());
        segmentStats.set('rotationSamples', rotationSamples.map(r => r.toString()).toString());
        segmentStats.set('bufferMs', this.playbackManager.getCurrentBufferInSeconds() * 1000);
        segmentStats.set('currSegmentId', String(this.playbackManager.nextFrameNoForPlayback).padStart(5, '0'));
        segmentStats.set('predSegmentId', String(predSegmentNo).padStart(5, '0'));
        segmentStats.set('predCameraPosition', cameraLater.position.toString());
        segmentStats.set('predCameraRotation', cameraLater.rotation.toString());
        // segmentStats.set('visiblesNowNames', visiblesNowNames.toString());
        // segmentStats.set('visiblesLaterNames', visiblesLaterNames.toString());
        segmentStats.set('visiblesLater', visiblesLater.map(o => o.getMetadata().name).toString());

        this.statsByVpPrediction.push(Object.fromEntries(segmentStats));
    }


    public static logScreenshotCaptured(frameId: string, screenshotData: string): void {
        this.screenshotsCaptured.push({'frame_id': frameId, 'screenshot_data': screenshotData});
    }


    public static saveSessionStats(): void {
        const timestamp = Math.trunc(Date.now()/1000);
        this.saveStatsByEvent(timestamp);
        this.saveStatsOverall(timestamp);
        this.saveScreenshotsCaptured();
    }

    private static saveStatsByEvent(timestamp: number): void {
        // this.saveAsFile(`${timestamp}_statsBySegment.json`, this.statsBySegment);

        (window as any).testResults.bySegmentDownload = this.statsBySegmentOnDownload;
        (window as any).testResults.bySegmentPlayback = this.statsBySegmentOnPlayback;
        (window as any).testResults.byTimeInterval = this.statsByTimeInterval;
        (window as any).testResults.byVpPrediction = this.statsByVpPrediction;
    }
    
    private static saveStatsOverall(timestamp: number): void {
        const statsOverall = new Map<string, string|number>();

        // Add stats to log
        statsOverall.set('chosenAbrStrategy', this.abrManager.getChosenStrategyAsString());
        statsOverall.set('chosenAbrMetric', Metrics.getChosenMetricAsString());
        statsOverall.set('chosenCameraRoute', this.routeManager.getChosenRouteAsString());
        statsOverall.set('chosenVpStrategy', this.cameraManager.getChosenVpStrategyAsString());

        statsOverall.set('chosenBufferForStartupS', this.playbackManager.getMinBufferForStartup());
        statsOverall.set('chosenBufferForResumeS', this.playbackManager.getMinBufferForResume());
        statsOverall.set('chosenBolaV', this.utils.chosenBolaV);
        statsOverall.set('chosenBolaGamma', this.utils.chosenBolaGamma);

        statsOverall.set('cumulativeStallMs', this.cumulativeStall);
        statsOverall.set('numStalls', this.numStalls);
        statsOverall.set('startupDelayMs', this.startupDelay);

        statsOverall.set('targetPlaybackFps', this.utils.targetPlaybackFps);
        if (this.playbackManager.endPlaybackTime != null && this.playbackManager.startPlaybackTime != null) {
            const playbackDurationLessStartupDelayAndStallsSec = (this.playbackManager.endPlaybackTime - this.playbackManager.startPlaybackTime - this.startupDelay - this.cumulativeStall) / 1000;
            const playbackFrames = (this.playbackManager.nextFrameNoForPlayback - 1);
            statsOverall.set('playbackDurationLessStartupDelayAndStallsSec', playbackDurationLessStartupDelayAndStallsSec);
            statsOverall.set('playbackFrames', playbackFrames);
            statsOverall.set('playbackFps', (playbackFrames / playbackDurationLessStartupDelayAndStallsSec));
        }

        // this.saveAsFile(`${timestamp}_statsOverall.json`, Object.fromEntries(statsOverall));
        (window as any).testResults.overall = Object.fromEntries(statsOverall);
    }

    private static saveScreenshotsCaptured(): void {
        (window as any).testResults.screenshotsCaptured = this.screenshotsCaptured;
    }

    private static saveAsFile(filename: string, data: Object): void {
        const blob = new Blob([JSON.stringify(data)]);
        const link = document.createElement("a");
        link.download = filename;
        link.href = window.URL.createObjectURL(blob);
        link.click()
    }
}