/*
 * Examples:
 * One-shot model:
 * User:  "Alexa, ask Auroa Forecast for zipcode 9 9 7 0 9."
 * Alexa: "Your 5 minute forecast for 9 9 7 0 9 is ten percent."
 */

'use strict';

var AlexaSkill = require('./AlexaSkill'),
    zips = require('./zip2LatLong.js'),
    fs = require('fs'),
    http = require('http');

/**
 * App ID for the skill
 */
var APP_ID = "amzn1.ask.skill.d605e495-cbcd-4f0b-ac95-29c97fdc6c1b"; //replace with 'amzn1.echo-sdk-ams.app.[your-unique-value-here]';

var FORECAST_URL = 'http://services.swpc.noaa.gov/text/aurora-nowcast-map.txt';
var FORECAST_FILE = '/tmp/aurora-nowcast-map.txt';
var FORECAST_STALE = 5 * 60 * 1000; // 5 minutes

var AuroraForecaster = function() {
  AlexaSkill.call(this, APP_ID);
};


AuroraForecaster.prototype = Object.create(AlexaSkill.prototype);
AuroraForecaster.prototype.constructor = AuroraForecaster;

AuroraForecaster.prototype.eventHandlers.onSessionStarted = function(sessionStartedRequest, session) {
  console.log(`AuroraForecaster onSessionStarted requestId: ${sessionStartedRequest.requestId}, sessionId: ${session.sessionId}`);
  //Session init.
  //
  //Should the getForecastFile call go here? 

};

AuroraForecaster.prototype.eventHandlers.onLaunch = function(launchRequest, session, response) {
  console.log(`AuroraForecaster onLaunch requestId: ${launchRequest.requestId}, sessionId: ${session.sessionId}`);
};

AuroraForecaster.prototype.eventHandlers.onSessionEnded = function(sessionEndedRequest, session){
  console.log(`AuroraForecaster onSessionEnded RequestId: ${sessionEndedRequest.requestId}, sessionId: ${session.sessionId}`);
};

AuroraForecaster.prototype.intentHandlers = { 
  "GetForecastIntent" : function(intent, session, response) {
    console.log(intent.slots);
    handleNewForecastRequest(intent, session, response);
  },
  "AMAZON.HelpIntent": function(intent, session, response) {
    response.ask("You can say tell me the forecast for your zip code, or, you can say exit... What can I help you with", "What zip code do you to forecast?");
  },
  "AMAZON.StopIntent": function(intent, session, response) {
    var speechOutput = "See you next time.";
    response.tell(speechOutput);
  },
  "AMAZON.CancelIntent": function(intent, session, response) {
    var speechOutput = "See you next time.";
    response.tell(speechOutput);
  }
};


//Way to get the forecast file after successful completion it call the main method
var getForecastFile = function(intent, session, response ){
  var clob = "";
  http.get(FORECAST_URL, (res) => {
    if (res.statusCode != 200)
      console.log(`Got response: ${res.statusCode}`);
    res.on('data', (chunk) => {
      //console.log("Got data to write");
      clob += chunk;
      //res.resume();
    });
    res.on('error', (e) => {
      console.log(`Got error: ${e.message}`);
    });
    res.on('end', () => {
      console.log('Finished downloading file.');
      fs.writeFileSync(FORECAST_FILE, clob );
      //Was calling main here. 
      main(intent, session, response);
    });
  });
};

//Function to parse fixed width format
var parseFixedWidth = function(line, size) {
    //console.log(`Recieved line: ${line}`);
  var newArray = [];
  for( var i = 0 ; i < line.length / size ; i++ ){
    newArray.push( parseInt( line.substring(i*size,i*size+size) ) );
  }
  //console.log( "Final Array size: " + newArray.length );
  return newArray;
};

//1024 values covering 0 to 360 degrees in the horizontal (longitude) direction 
//  (0.32846715 degrees/value)
//  Take whatever longitude we want and map to the array location.
//  1. If negative, turn it into the positive equivalent.
//  2. Determine whic box between 0 and 1024 it lives on by integer based division.
// var LON_SLICE = 0.32846715;
var LON_SLICE = 0.3515625; 
var mapLon = function(lon){
  if ( lon < 0 ) 
    lon += 180;
  return Math.floor(lon / LON_SLICE ) ;
};
//Takes a number between 0 and 1023, and returns an array with bounding longitudes
var reverseMapLon = function(lonIndex){
  if (lonIndex < 0 || lonIndex > 1023)
    return null;
  var lonArray = [];
  lonArray.push(lonIndex * LON_SLICE - 180 );
  lonArray.push(lonIndex * LON_SLICE + LON_SLICE - 180);
  return lonArray;
};

//512 values covering -90 to 90 degrees in the vertical (latitude) direction  
//  (0.3515625 degrees/value)
//  1. Determine where from 0 to 512 this lives. 
var LAT_SLICE = 0.3515625; 
var mapLat = function(lat){
   lat += 90;
   return Math.floor( lat / LAT_SLICE );
};

//Takes a latitude index between 0 and 511 and returns an array with bounding latitudes
var reverseMapLat = function(latIndex){
  if (latIndex < 0 || latIndex > 511 )
    return null;
  var latArray = [] ;
  latArray.push(latIndex * LAT_SLICE - 90 );
  latArray.push(latIndex * LAT_SLICE + LAT_SLICE -90);
  return latArray;
};

var getForecast = function(place){
  if( ! place.hasOwnProperty("lat") || ! place.hasOwnProperty("lon") ){
    return { "error": "Did no receive a valid place." } ;
  }
  var array = fs.readFileSync(FORECAST_FILE).toString().split("\n");
  var forecastData = [];
  var line;
  for (line in array){
    if ( ! array[line].startsWith("#") ) {
     //Each line is the latitude, and sub array of longitudes
     forecastData.push( parseFixedWidth(array[line] ,4) );
    } 
  }
  console.log(forecastData.length);
  var lat = mapLat(place.lat);
  var lon = mapLon(place.lon);
  //console.log("LatMapped: " + lat + ", LonMapped: " + lon);
  var latBox = reverseMapLat(lat);
  var lonBox = reverseMapLon(lon);
  //console.log("Top left: [" + latBox[0] + "," + lonBox[0] + "] Bottom right: [" + latBox[1] + ", " + lonBox[1] + "]");
  return (forecastData[lat][lon]);

};

var main = function(intent, session, response){
  //console.log(intent);
  //Assemble the 5 numbers. 
  var zipToLookup = "";
  if (intent.slots.numone !== null && 
      intent.slots.numtwo !== null &&
      intent.slots.numthree !== null &&
      intent.slots.numfour !== null &&
      intent.slots.numfive !== null ) { 
    var n1 = intent.slots.numone.value;
    var n2 = intent.slots.numtwo.value;
    var n3 = intent.slots.numthree.value;
    var n4 = intent.slots.numfour.value;
    var n5 = intent.slots.numfive.value;
    zipToLookup = ""+n1+n2+n3+n4+n5;
  }
   //console.log(`zipToLookup: ${zipToLookup}`)
  var zipSay = n1 + ". " + n2 + ". " + n3 + ". " + n4 + ". " + n5 + ".";
   
   //console.log(`zips has it?: ${zips.hasOwnProperty(zipToLookup)}`);
   
  if ( zips.hasOwnProperty(zipToLookup) ){

    var geoLocation = zips[zipToLookup];
    var geoLocForecast = getForecast(geoLocation);
    console.log("geoLocation: [" + geoLocation.lat + ", " + geoLocation.lon + "]");
    console.log("Forecast for geoLocation: " + geoLocForecast + " percent chance.");

    var say = "There is a " + geoLocForecast + " percent chance of seeing the Aurora for zip code " ;
    
    var speechOutput = say + zipSay;

    var cardTitle = "Aurora Forecast"
    var cardSay = say + zipToLookup + "."

    response.tellWithCard(speechOutput, cardTitle, cardSay);
  } else {
    //Let them know that there was some fail going on here.
     var speechOutput2 = "I could not find the zipcode " + zipSay + ". Try another.";
    response.tell(speechOutput2);
  }

};

function handleNewForecastRequest(intent, session, response){
  try {
    if ( ! fs.existsSync(FORECAST_FILE) ) {
      //get the FORECAST_FILE
      console.log("We must get the file.");
      getForecastFile(intent, session, response);
    } else if ( (new Date() ) - fs.statSync(FORECAST_FILE).mtime > FORECAST_STALE) {
      console.log("Stale data file detected.");
      getForecastFile(intent, session, response);
    } else {
      main(intent, session, response);
    }
    //var lastUpdate = fs.statSync(FORECAST_FILE).mtime;
  
  } catch(e) {
    console.log(`Catching: ${e.message}`);
  }
}
  
exports.handler = function(event, context) {
 //Create instance to respond with.
 var forecast = new AuroraForecaster();
 forecast.execute(event, context); 
};
