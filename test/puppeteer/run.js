const fs = require("fs");
const puppeteer = require("puppeteer-core");
const normalNetworkPatterns = require("./normal-network-patterns.js");
// const fastNetworkPatterns = require("./fast-network-patterns.js");
// const stats = require("./stats");
const CHROME_PATH ="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
//const CHROME_PATH = "/opt/google/chrome/chrome";

// const {QoeEvaluator, QoeInfo} = require("../dash.js/samples/low-latency/abr/LoLp_QoEEvaluation.js");

// let patterns;
// if (process.env.npm_package_config_ffmpeg_profile === 'PROFILE_FAST') {
//   patterns = fastNetworkPatterns;
// } else {
//   patterns = normalNetworkPatterns
// }
let patterns = normalNetworkPatterns

const configNetworkProfile = process.env.npm_package_config_network_profile;
let NETWORK_PROFILE;
if (patterns[configNetworkProfile]) {
  NETWORK_PROFILE = patterns[configNetworkProfile]
} else {
  console.log("Error! network_profile not found, exiting with code 1...");
  process.exit(1);
}
console.log("Network profile:", configNetworkProfile);
console.log(NETWORK_PROFILE);

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

        let filenameByDownload = folder + '/results-by-download.json';
        let filenameOverall = folder + '/results-overall.json';
        let filenameEvaluate = folder + '/evaluate.json';
        // let filenameQoePerSegment = folder + '/qoe-by-segment.json';
        // let filenameThroughput = folder + '/throughput-measurements.json';
      
        fs.writeFileSync(filenameByDownload, JSON.stringify(result.byDownload));
        fs.writeFileSync(filenameOverall, JSON.stringify(result.overall));

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

        evaluate.totalGeometrySize = 0;
        result.byDownload.forEach((dataByDownload) => evaluate.totalGeometrySize += dataByDownload.geometrySize);

        
        // convert string to boolean
        const batchTestEnabled = (process.env.npm_package_batchTest_enabled == 'true');

        // finally, allow to optionally input comments
        if (!batchTestEnabled) {
          // user input
          readline.question('Any comments for this test run: ', data => {
            evaluate.comments = data;
            readline.close();
            
            fs.writeFileSync(filenameEvaluate, JSON.stringify(evaluate));
            // fs.writeFileSync(filenameQoePerSegment, JSON.stringify(qoePerSegment));
            // fs.writeFileSync(filenameThroughput, JSON.stringify(throughputMeasurements));
  
            // // Generate csv file
            // let csv = '';
            // for (var i = 0; i < qoeBySegmentCsv.length; i++) {
            //   csv += qoeBySegmentCsv[i];
            //   csv += '\n';
            // }
            // fs.writeFileSync(filenameQoePerSegment, csv);
  
            console.log('Results files generated:');
            console.log('> ' + filenameByDownload);
            console.log('> ' + filenameOverall);
            console.log('> ' + filenameEvaluate);
            // console.log('> ' + filenameQoePerSegment);
            // console.log('> ' + filenameThroughput);
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
        //   fs.writeFileSync(filenameQoePerSegment, JSON.stringify(qoePerSegment));
        //   fs.writeFileSync(filenameThroughput, JSON.stringify(throughputMeasurements));
  
          console.log('Results files generated:');
          console.log('> ' + filenameByDownload);
          console.log('> ' + filenameOverall);
          console.log('> ' + filenameEvaluate);
        //   console.log('> ' + filenameQoePerSegment);
        //   console.log('> ' + filenameThroughput);
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
    //   devtools: true,
      devtools: false,
      args: [
        '--incognito',
        '--enable-quic', 
        '--allow-insecure-localhost', 
        // '--origin-to-force-quic-on=127.0.0.1:8443,192.168.68.72:8443',  //FOR H3
        '--ignore-certificate-errors', 
        '--user-data-dir=/tmp/temp-chrome', 
        '--ignore-certificate-errors-spki-list=HuIJVf4kd40thmlnVs/PjG3tjU81PvY2uv3UoN2p37g='
        ]
    });

    // ORIGINAL (puppeteer v2.1.1)
    // // const page = await browser.newPage();
    // // Create a new incognito browser context.
    // const context = await browser.createIncognitoBrowserContext();
    // // Create a new page in a pristine context.
    // const page = await context.newPage();
    // //test mode setuser agent to puppeteer
    // page.setUserAgent("puppeteer");

    // NEW (puppeteer v22.8.0)
    // Launch the browser and open a new blank page
    const page = await browser.newPage();
    //test mode setuser agent to puppeteer
    page.setUserAgent("puppeteer");

    // await page.goto("http://localhost:3000/samples/low-latency/index.html");
    await page.goto("https://127.0.0.1:8080/");

    await page.setCacheEnabled(false);
    const cdpClient = await page.target().createCDPSession();

    console.log("Waiting for player to setup.");
    await page.evaluate(() => {
      return new Promise(resolve => {
        // const hasLoaded = player.getBitrateInfoListFor("video").length !== 0;
        // if (hasLoaded) {
        //   console.log('Stream loaded, setup complete.');
        //   resolve();
        // } else {
        //   console.log('Waiting for stream to load.');
        //   player.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, (e) => {
        //     console.log('Load complete.')
        //     resolve();
        // });
        // }

        console.log('Waiting for page to load.');
        // console.log(player)
        // resolve();
        // player.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, (e) => {
        //     console.log('Load complete.')
        //     resolve();
        // });

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
    // console.log("Beginning network emulation");
    // runNetworkPattern(cdpClient, NETWORK_PROFILE);
    // ************************************************************************
    // [TODO] Update to automatically trigger server-side tc shaping via request to nginx
    // ************************************************************************


    /**
     * Wait for playback to stop and Collect test results
     */
    const testResults = await page.evaluate(() => {
        //   console.log('@@@@@@@@ test1a');
        //   if (window.stopRecording) {
        //     // Guard against closing the browser window early
        //     window.stopRecording();
        //   }
        // //   player.pause();
        // //   return window.abrHistory;

        //   console.log('@@@@@@@@ test1b');
        //   console.log(window.testResults);
        //   return window.testResults;

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
    console.log(testResults);
    console.log('Processing client testResults to results files..');

    // results-by-download.json
    let resultsByDownload = {};
    let numStalls = 0;
    if (testResults.byDownload) {
      resultsByDownload = testResults.byDownload;
    //   for (var key in resultsByDownload) {
    //     if (resultsByDownload.hasOwnProperty(key)) { 
    //         resultsByDownload[key].averageBitrate = stats.computeAverageBitrate(resultsByDownload[key].switchHistory, resultsByDownload[key].downloadTimeRelative);
    //         resultsByDownload[key].numSwitches = resultsByDownload[key].switchHistory.length;
    //         if (resultsByDownload[key].numStalls > numStalls)  numStalls = resultsByDownload[key].numStalls;
    //     }
    //   }
    }

    // results-overall.json
    let resultsOverall = {};
    if (testResults.overall) {
      resultsOverall = testResults.overall;
    //   resultsOverall.averageBitrate = stats.computeAverageBitrate(resultsOverall.switchHistory);
    //   resultsOverall.numSwitches = resultsOverall.switchHistory.length;
    //   resultsOverall.numStalls = numStalls;
    //   // calculate averageBitrateVariations
    //   if (resultsOverall.switchHistory.length > 1) {
    //     let totalBitrateVariations = 0;
    //     for (var i = 0; i < resultsOverall.switchHistory.length - 1; i++) {
    //       totalBitrateVariations += Math.abs(resultsOverall.switchHistory[i+1].quality.bitrate - resultsOverall.switchHistory[i].quality.bitrate);
    //     }
    //     resultsOverall.averageBitrateVariations = totalBitrateVariations / (resultsOverall.switchHistory.length - 1);
    //   } else {
    //     resultsOverall.averageBitrateVariations = 0; 
    //   }
    //   // calculate average playback rates
    //   let pbr = stats.computeAveragePlaybackRate(resultsByDownload);
    //   resultsOverall.averagePlaybackRate = pbr.averagePlaybackRate;
    //   resultsOverall.averagePlaybackRateNonOne = pbr.averagePlaybackRateNonOne;
    //   // delete unwanted data
    //   delete resultsOverall.currentLatency;
    //   delete resultsOverall.currentBufferLength;
    }

    let result = {
      byDownload: resultsByDownload,
      overall: resultsOverall,
      networkProfile: configNetworkProfile,
      networkPattern: NETWORK_PROFILE,
      abrStrategy: testResults.abrStrategy,
    //   customPlaybackControl: testResults.customPlaybackControl,
    //   misc: testResults.misc
    };

    return result;

  }


  async function runNetworkPattern(client, pattern) {
    for await (const profile of pattern) {
      console.log(
        // `Setting network speed to ${profile.speed}kbps for ${profile.duration} seconds`
        `Setting network speed to ${profile.speed}mbps for ${profile.duration} seconds`
      );
      throughputMeasurements.trueValues.push({ 
        throughputKbps: profile.speed, 
        duration: profile.duration, 
        startTimestampMs: Date.now() 
      });

      setNetworkSpeedInMbps(client, profile.speed);
      await new Promise(resolve => setTimeout(resolve, profile.duration * 1000));
    }
  }

  function setNetworkSpeedInMbps(client, mbps) {
    client.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 0,
      uploadThroughput: (mbps * 1024) / 8,
      downloadThroughput: (mbps * 1024) / 8
    });
  }

});