const fs = require("fs");
const puppeteer = require("puppeteer-core");
// const stats = require("./stats");
const CHROME_PATH ="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
//const CHROME_PATH = "/opt/google/chrome/chrome";


// ********* WIDE-VR ********* //
const networkPatterns5GLumous = require("./network-patterns/5g-lumous.js");

// const fileSizesByFilePath = require("../../server/nginx/static/media/filepath_to_size_mapping.js");  // 300f
const fileSizesByFilePath = require("../../server/nginx/static/media/filepath_to_size_mapping_600f.js");

// ********* WIDE-VR ********* //
let patterns = networkPatterns5GLumous

const configNetworkProfile = process.env.npm_package_config_network_profile;
let NETWORK_PROFILE;
if (configNetworkProfile === 'PROFILE_NO_THROTTLING') {
  NETWORK_PROFILE = 'PROFILE_NO_THROTTLING';
} else {
  if (patterns[configNetworkProfile]) {
    NETWORK_PROFILE = patterns[configNetworkProfile]
  } else {
    console.log("Error! network_profile not found, exiting with code 1...");
    process.exit(1);
  }
  console.log("Network profile:", configNetworkProfile);
}

// custom
const readline = require('readline').createInterface({ input: process.stdin, output: process.stdout });
let throughputMeasurements = { trueValues: [], measuredValues: [] };

// Wait X ms before starting browser
function sleep (time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}
// const waitSeconds = 10;
const waitSeconds = 2;
console.log('Wait ' + waitSeconds + 's before starting browser..');
sleep(waitSeconds * 1000).then(() => {

  run()
    .then((result) => {
      if (result) {
        if (!fs.existsSync('./results')){
          fs.mkdirSync('./results');
        }

        let timestamp = Math.floor(Date.now() / 1000);
        let folder = './results/' + timestamp;
        if (process.env.npm_package_batchTest_resultFolder)
          folder = './results/' + process.env.npm_package_batchTest_resultFolder + '/' + timestamp;
        if (!fs.existsSync(folder)){
          fs.mkdirSync(folder);
        }

        let filenameByDownload = folder + '/results-by-segment-download.json';
        let filenameByPlayback = folder + '/results-by-segment-playback.json';
        let filenameByInterval = folder + '/results-by-time-interval.json';
        let filenameByVpPrediction = folder + '/results-by-vp-prediction.json';
        let filenameOverall = folder + '/results-overall.json';
        let filenameEvaluate = folder + '/evaluate.json';
      
        fs.writeFileSync(filenameByDownload, JSON.stringify(result.bySegmentDownload));
        fs.writeFileSync(filenameByPlayback, JSON.stringify(result.bySegmentPlayback));
        fs.writeFileSync(filenameByInterval, JSON.stringify(result.byTimeInterval));
        fs.writeFileSync(filenameByVpPrediction, JSON.stringify(result.byVpPrediction));
        fs.writeFileSync(filenameOverall, JSON.stringify(result.overall));

        // Save screenshots captured and compute perceptual quality
        for (let i = 0; i < result.screenshotsCaptured.length; i++) {
          let filename = folder + '/screenshot_' + result.screenshotsCaptured[i]['frame_id'] + '.png';
          var base64Data = result.screenshotsCaptured[i]['screenshot_data'].replace(/^data:image\/png;base64,/, "");
          fs.writeFileSync(filename, base64Data, 'base64');
          

        }

        /////////////////////////////////////
        // evaluate.js
        /////////////////////////////////////
        /* testTime, networkPattern, abrStrategy, comments, etc.
        * + resultsQoe obj
        *  - averageBitrate
        *  - averageBitrateVariations / numSwitches (added both)
        *  - totalRebufferTime
        *  - startupDelay (not used for now as startup is invalid with stabilization feature in the testing)
        *  - averageLatency (not in standard QoE model but avail here first)
        */
        let evaluate = {};
        evaluate.testTime = new Date();
        evaluate.networkProfile = result.networkProfile;
        evaluate.networkPattern = result.networkPattern;
        evaluate.abrStrategy = result.abrStrategy;

        evaluate.totalGeometrySizeOld = 0;
        result.bySegmentDownload.forEach((dataByDownload) => evaluate.totalGeometrySizeOld += dataByDownload.geometrySize);

        // Calculate total geometry and texture sizes
        evaluate.totalGeometrySize = { "combined": 0 };
        evaluate.totalTextureSize = { "combined": 0 };

        for (let i = 0; i < result.bySegmentDownload.length; i++) {
          let objectName = result.bySegmentDownload[i].objectName;
          if (!(objectName in evaluate.totalGeometrySize)) {
            evaluate.totalGeometrySize[objectName] = 0;
            evaluate.totalTextureSize[objectName] = 0;
          }

          let geometryFilepath = result.bySegmentDownload[i].geometryResUrl.split('static/media/').pop();
          let textureFilepath = result.bySegmentDownload[i].textureResUrl.split('static/media/').pop();
          let geometryFileSize = fileSizesByFilePath['fileSizesByFilePath'][geometryFilepath];
          let textureFileSize = fileSizesByFilePath['fileSizesByFilePath'][textureFilepath];

          evaluate.totalGeometrySize[objectName] += geometryFileSize;
          evaluate.totalGeometrySize["combined"] += geometryFileSize;

          evaluate.totalTextureSize[objectName] += textureFileSize;
          evaluate.totalTextureSize["combined"] += textureFileSize;
        }

        
        // Calcualte average bitrate
        // evaluate.averageBitrateMbps = (evaluate.totalGeometrySize + evaluate.totalTextureSize) * 8 / (1024 * 1024) / result.overall.playbackDurationLessStartupDelayAndStallsSec;
        evaluate.averageBitrateMbps = {};
        Object.keys(evaluate.totalGeometrySize).forEach(function(key, index) {
          evaluate.averageBitrateMbps[key] = (evaluate.totalGeometrySize[key] + evaluate.totalTextureSize[key]) * 8 / (1024 * 1024) / result.overall.playbackDurationLessStartupDelayAndStallsSec;
        });


        // Calculate average quality level
        runningTotalQualityLevel = { "combined": 0 };
        runningCount = { "combined": 0 };
        for (let i = 0; i < result.bySegmentDownload.length; i++) {
          let objectName = result.bySegmentDownload[i].objectName;
          if (!(objectName in runningTotalQualityLevel)) {
            runningTotalQualityLevel[objectName] = 0;
            runningCount[objectName] = 0;
          }

          runningTotalQualityLevel[objectName] += result.bySegmentDownload[i].geometryQuality;  // Same quality level for geometry and texture
          runningCount[objectName] += 1;

          runningTotalQualityLevel["combined"] += result.bySegmentDownload[i].geometryQuality;  // Same quality level for geometry and texture
          runningCount["combined"] += 1;
        }
        evaluate.averageQualityLevel = {};
        Object.keys(runningTotalQualityLevel).forEach(function(key, index) {
          evaluate.averageQualityLevel[key] = runningTotalQualityLevel[key] / runningCount[key];
        });
        

        // Calculate number of switches
        evaluate.numSwitches_total = { "combined": 0 };
        evaluate.numSwitches_by1Levels = { "combined": 0 };
        evaluate.numSwitches_by2Levels = { "combined": 0 };
        evaluate.numSwitches_by3Levels = { "combined": 0 };

        evaluate.magSwitchesMbps_total = { "combined": 0 };
        evaluate.magSwitchesMbps_count = { "combined": 0 };

        previousQualityByObj = {}
        previousFileSizeByObj = {}

        for (let i = 0; i < result.bySegmentDownload.length; i++) {
          let objectName = result.bySegmentDownload[i].objectName;
          if (!(objectName in evaluate.numSwitches_total)) {
            evaluate.numSwitches_total[objectName] = 0;
            evaluate.numSwitches_by1Levels[objectName] = 0;
            evaluate.numSwitches_by2Levels[objectName] = 0;
            evaluate.numSwitches_by3Levels[objectName] = 0;

            evaluate.magSwitchesMbps_total[objectName] = 0;
            evaluate.magSwitchesMbps_count[objectName] = 0;
          }

          let geometryFilepath = result.bySegmentDownload[i].geometryResUrl.split('static/media/').pop();
          let textureFilepath = result.bySegmentDownload[i].textureResUrl.split('static/media/').pop();
          let geometryFileSize = fileSizesByFilePath['fileSizesByFilePath'][geometryFilepath];
          let textureFileSize = fileSizesByFilePath['fileSizesByFilePath'][textureFilepath];
          let totalFileSize = geometryFileSize + textureFileSize;
          let qualityLevel = result.bySegmentDownload[i].geometryQuality;  // Same quality level for geometry and texture

          // First segment of object
          if (!(objectName in previousQualityByObj)) {  // Initialize quality and file size
            previousQualityByObj[objectName] = qualityLevel;
            previousFileSizeByObj[objectName] = totalFileSize;
          } 
          else {  // All other segments of object
            let diffInQualityLevel = Math.abs(previousQualityByObj[objectName] - qualityLevel);
            if (diffInQualityLevel == 0) { continue };  // No switch happened

            // Add to total switches first
            evaluate.numSwitches_total[objectName] += 1;
            evaluate.numSwitches_total["combined"] += 1;

            // Then differentiate switches by the # of levels
            switch(diffInQualityLevel) {
              case 1:
                // evaluate.numSwitches_by1Levels += 1;
                evaluate.numSwitches_by1Levels[objectName] += 1;
                evaluate.numSwitches_by1Levels["combined"] += 1;
                break;
              case 2:
                // evaluate.numSwitches_by2Levels += 1;
                evaluate.numSwitches_by2Levels[objectName] += 1;
                evaluate.numSwitches_by2Levels["combined"] += 1;
                break;
              case 3:
                // evaluate.numSwitches_by3Levels += 1;
                evaluate.numSwitches_by3Levels[objectName] += 1;
                evaluate.numSwitches_by3Levels["combined"] += 1;
                break;
              default:
                break;
            }

            let diffInFileSize = Math.abs(previousFileSizeByObj[objectName] - totalFileSize);  // in bytes
            let diffInFileSizeMbps = diffInFileSize * 8 / (1024 * 1024) * result.overall.targetPlaybackFps;

            evaluate.magSwitchesMbps_total[objectName] += diffInFileSizeMbps;
            evaluate.magSwitchesMbps_total["combined"] += diffInFileSizeMbps;

            evaluate.magSwitchesMbps_count[objectName] += 1;
            evaluate.magSwitchesMbps_count["combined"] += 1;

            // Update tracker of previous quality and file size
            previousQualityByObj[objectName] = qualityLevel;
            previousFileSizeByObj[objectName] = totalFileSize;
          }
        }
        
        // Calculate average magnitude per switch
        evaluate.magSwitchesMbps_average = {};
        Object.keys(evaluate.magSwitchesMbps_total).forEach(function(key, index) {
          evaluate.magSwitchesMbps_average[key] = evaluate.magSwitchesMbps_total[key] / evaluate.magSwitchesMbps_count[key];
        });
        



        // Copy over selected evaluation metrics from client-side test results
        evaluate.chosenAbrStrategy = result.overall.chosenAbrStrategy;
        evaluate.chosenAbrMetric = result.overall.chosenAbrMetric;
        evaluate.chosenCameraRoute = result.overall.chosenCameraRoute;
        evaluate.chosenVpStrategy = result.overall.chosenVpStrategy;

        evaluate.chosenBufferForStartupS = result.overall.chosenBufferForStartupS;
        evaluate.chosenBufferForResumeS = result.overall.chosenBufferForResumeS;
        evaluate.chosenBolaV = result.overall.chosenBolaV;
        evaluate.chosenBolaGamma = result.overall.chosenBolaGamma;
        evaluate.chosenHttpVersion = process.env.npm_package_config_http_version;

        evaluate.cumulativeStallMs = result.overall.cumulativeStallMs;
        evaluate.numStalls = result.overall.numStalls;
        evaluate.videoDurationSec = result.overall.playbackDurationLessStartupDelayAndStallsSec;


        // Convert string to boolean
        const batchTestEnabled = (process.env.npm_package_config_batchTest_enabled == 'true');

        // Finally, allow to optionally input comments
        if (!batchTestEnabled) {
          // user input
          readline.question('Any comments for this test run: ', data => {
            evaluate.comments = data;
            readline.close();
            
            fs.writeFileSync(filenameEvaluate, JSON.stringify(evaluate));
  
            console.log('Results files generated:');
            console.log('> ' + filenameByDownload);
            console.log('> ' + filenameByPlayback);
            console.log('> ' + filenameByInterval);
            console.log('> ' + filenameByVpPrediction);
            console.log('> ' + filenameOverall);
            console.log('> ' + filenameEvaluate);
            console.log("Test finished. Press cmd+c to exit.");
          });
        }
        else {
          // batch script input
          if (process.env.npm_package_batchTest_comments)
            evaluate.comments = process.env.npm_package_batchTest_comments;
          else
            evaluate.comments = "Batch test, no additional comments."

          fs.writeFileSync(filenameEvaluate, JSON.stringify(evaluate));
  
          console.log('Results files generated:');
          console.log('> ' + filenameByDownload);
          console.log('> ' + filenameOverall);
          console.log('> ' + filenameEvaluate);
          console.log('')

          process.exit(0);
        }
      }
      else {
        console.log('Unable to generate test results, likely some error occurred.. Please check program output above.')
        console.log("Exiting with code 1...");
        process.exit(1);
      }
    })
    .catch(error => console.log(error));

  async function run() {
    const browser = await puppeteer.launch({
      headless: false,
      executablePath: CHROME_PATH,
      defaultViewport: null,
      // devtools: true,
      devtools: false,
      args: [
        '--incognito',
        '--enable-quic', 
        '--allow-insecure-localhost', 
        // '--origin-to-force-quic-on=127.0.0.1:8443,192.168.68.70:8443',  //FOR H3 (comment out for the others)
        '--ignore-certificate-errors', 
        // '--user-data-dir=/tmp/temp-chrome',   //DO NOT USE THIS; CAUSES CACHING
        '--ignore-certificate-errors-spki-list=seBae9z/FuWRRp4Ljfcj2QCEo5GuXaxrjExh8v1wInI=',
        `--window-size=1920,1080`,
        ],
        defaultViewport: null
    });

    // Launch the browser and open a new blank page
    const page = await browser.newPage();
    //test mode setuser agent to puppeteer
    page.setUserAgent("puppeteer");

    await page.goto("https://192.168.68.70:8080/");

    // await page.setCacheEnabled(false);
    const cdpClient = await page.target().createCDPSession();

    console.log("Waiting for player to setup.");
    await page.evaluate(() => {
      return new Promise(resolve => {

        console.log('Waiting for page to load.');

        window.addEventListener('sceneInitialize', function () {
            console.log('Scene initialized.');
            // Start playing the stream
            document.getElementById("overlayPlayBtn").click();
            resolve();
        })
      });
    });

    
    /**
     * Begin network emulation
     */
    console.log("Beginning network emulation");
    runNetworkPattern(cdpClient, NETWORK_PROFILE);
    // ************************************************************************
    // [TODO] Update to automatically trigger server-side tc shaping via request to nginx
    // ************************************************************************


    /**
     * Wait for playback to stop and Collect test results
     */
    const testResults = await page.evaluate(() => {

        return new Promise(resolve => {
            window.addEventListener('playbackStop', function () {
                console.log('Playback stopped.');
                resolve(window.testResults);
            })
        });
    });
    console.log("Run complete");
    if (!testResults) {
      console.log("No testResults were returned. Stats will not be logged.");
    }


    /**
     * Results returned
     */
    // console.log(testResults);
    console.log('Processing client testResults to results files..');

    // results-by-download.json
    let resultsBySegmentDownload = {};
    let numStalls = 0;
    if (testResults.bySegmentDownload) {
      resultsBySegmentDownload = testResults.bySegmentDownload;
    }

    let resultsBySegmentPlayback = {};
    if (testResults.bySegmentPlayback) {
      resultsBySegmentPlayback = testResults.bySegmentPlayback;
    }

    let resultsByTimeInterval = {};
    if (testResults.byTimeInterval) {
      resultsByTimeInterval = testResults.byTimeInterval;
    }

    let resultsByVpPrediction = {};
    if (testResults.byVpPrediction) {
      resultsByVpPrediction = testResults.byVpPrediction;
    }

    // results-overall.json
    let resultsOverall = {};
    if (testResults.overall) {
      resultsOverall = testResults.overall;
    }

    let result = {
      bySegmentDownload: resultsBySegmentDownload,
      bySegmentPlayback: resultsBySegmentPlayback,
      byTimeInterval: resultsByTimeInterval,
      byVpPrediction: resultsByVpPrediction,
      overall: resultsOverall,
      networkProfile: configNetworkProfile,
      networkPattern: NETWORK_PROFILE,
      abrStrategy: testResults.abrStrategy
    };

    if (testResults.screenshotsCaptured) {
      result.screenshotsCaptured = testResults.screenshotsCaptured;
    } else {
      result.screenshotsCaptured = [];
    }

    return result;

  }


  async function runNetworkPattern(client, pattern) {
    if (pattern != 'PROFILE_NO_THROTTLING') { // And do nothing if it is no_throttling
      for await (const profile of pattern) {
        console.log(
          // `Setting network speed to ${profile.speed}kbps for ${profile.duration} seconds`
          `Setting network speed to ${profile.speed}mbps for ${profile.duration} seconds`
        );
        throughputMeasurements.trueValues.push({ 
          // throughputKbps: profile.speed, 
          throughputMbps: profile.speed, 
          duration: profile.duration, 
          startTimestampMs: Date.now() 
        });

        setNetworkSpeedInMbps(client, profile.speed);
        await new Promise(resolve => setTimeout(resolve, profile.duration * 1000));
      }
    }
  }

  // throughput in Bytes per s based on puppeteer v22.8.0 (https://pptr.dev/api/puppeteer.networkconditions)
  function setNetworkSpeedInMbps(client, mbps) {
    client.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 0,
      uploadThroughput: (mbps * 1024 * 1024) / 8,
      downloadThroughput: (mbps * 1024 * 1024) / 8
    });
  }

});