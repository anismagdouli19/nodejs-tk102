/*
Name:         tk102
Description:  TK102 GPS server for Node.js
Author:       Franklin van de Meent (https://frankl.in)
Source:       https://github.com/fvdm/nodejs-tk102
Feedback:     https://github.com/fvdm/nodejs-tk102/issues
License:      Unlicense (Public Domain, see UNLICENSE file)
              <https://github.com/fvdm/nodejs-tk102/raw/master/UNLICENSE>
*/
const mongodbHelper = require('./lib/mongodbHelper');
const tk102 = require('./lib/tk102');
const net = require('net');
const config = require('./config');
const log4js = require('log4js');
log4js.configure(config.log4js);
const logger = log4js.getLogger('TRACKING');

const TrackStore = require('./lib/trackStore');
const trackstore = new TrackStore();

//var gps = '1203292316,0031698765432,GPRMC,211657.000,A,5213.0247,N,00516.7757,E,0.00,273.30,290312,,,A*62,F,imei:123456789012345,123';
var gps = '1203292316,0031698765432,GPRMC,211657.000,A,4706.0485,N,01525.4577,E,0.00,273.30,290312,,,A*62,F,imei:123456789012345,123';
const china_tk102_gpsstring = '#353588102011094##1#0000#AUT#01#2320011dbf9ac0#01525.4577,E,4706.0485,N,0.00,0.00#260218#091514.000##';


// fancy console log
function output(data) {
    console.log('\nIncoming GPS data:\n');
    console.dir(data, {
        colors: String(process.env.TERM)
            .match(/color$/)
    });
}

trackstore.getEmitter()
    .on('finished', finishedTrack => {
        console.log(finishedTrack);

        console.log(trackstore.getTracks());


        let insertObj = finishedTrack;

        mongodbHelper.findDocuments("equipment", {imei: finishedTrack.imei})
            .then(docs => {
                logger.info(docs[0]);
                insertObj.equipment = [];
                insertObj.equipment.push(docs[0]);
                const promisePilot = mongodbHelper.findDocuments("pilots", {account_id: docs[0].account_id});
                const promiseDrone = mongodbHelper.findDocuments("drones", {account_id: docs[0].account_id});

                Promise.all([promisePilot, promiseDrone])
                    .then(docs => {
                        logger.info(docs);
                        insertObj.pilot = docs[0][0];
                        insertObj.drone = docs[1][0];
                        insertObj.date = new Date(finishedTrack.datetime);
                        insertObj.account_id = docs[0][0].account_id;

                        trackstore.getTracks()
                        insertObj.pilotName = docs[0][0].title ? docs[0][0].title + ' ' + docs[0][0].name + ' ' + docs[0][0].surname : docs[0][0].name + ' ' + docs[0][0].surname;
                        insertObj.droneName = docs[1][0].manufacturer + ' ' + docs[1][0].model;

                        insertObj.processed = true;
                        insertObj.processingError = false;

                        insertObj.location = 'TODO reverse geo coding';

                        insertObj.distance = 'TODO';

                        mongodbHelper.insertDocument('flights', insertObj)
                            .then(logger.info('INSERT  complete!'))
                            .catch(err => logger.error('INSERT failed! \n' + err))

                    })
                    .catch(err => logger.error(err));
            })
            .catch(err => logger.error(err));
    });


/*
trackstore.getEmitter()
    .on('finished', finishedTracks => {
        console.log(finishedTracks);

        finishedTracks.forEach(track => {

            let insertObj = track;

            mongodbHelper.findDocuments("equipment", {imei: track.imei})
                .then(docs => {
                    logger.info(docs[0]);
                    insertObj.equipment = [];
                    insertObj.equipment.push(docs[0]);
                    const promisePilot = mongodbHelper.findDocuments("pilots", {account_id: docs[0].account_id});
                    const promiseDrone = mongodbHelper.findDocuments("drones", {account_id: docs[0].account_id});

                    Promise.all([promisePilot, promiseDrone])
                        .then(docs => {
                            logger.info(docs);
                            insertObj.pilot = docs[0][0];
                            insertObj.drone = docs[1][0];
                            insertObj.date = new Date(track.datetime);
                            insertObj.account_id = docs[0][0].account_id;

                            insertObj.pilotName = docs[0][0].title ? docs[0][0].title + ' ' + docs[0][0].name + ' ' + docs[0][0].surname : docs[0][0].name + ' ' + docs[0][0].surname;
                            insertObj.droneName = docs[1][0].manufacturer + ' ' + docs[1][0].model;

                            insertObj.processed = true;
                            insertObj.processingError = false;

                            insertObj.location = 'TODO reverse geo coding';

                            insertObj.distance = 'TODO';

                            mongodbHelper.insertDocument('flights', insertObj)
                                .then(logger.info('INSERT  complete!'))
                                .catch(err => logger.error('INSERT failed! \n' + err))

                        })
                        .catch(err => logger.error(err));
                })
                .catch(err => logger.error(err));
        });
    });

*/
// report only track event to console
tk102.on('data', output);

tk102.on('track', (data) => {
    output(data);
    logger.info('incoming from IMEI:', data.imei, 'GEO:', data.geo);

    let track = {};
    track.gpsData = [];
    track.gpsData.push({
        lat: data.geo.latitude,
        lng: data.geo.longitude,
        e: 500,
        t: new Date(data.datetime),
        s: 0.5
    });
    track.datetime = data.datetime;
    track.imei = data.imei;

    trackstore.addData(track);
});

// wait for server to be ready
tk102.on('listening', function (lst) {
    var client;

    console.log('TK102 server is ready');

// Send data with telnet
    client = net.connect(lst.port, function () {
        console.log('Connected to TK102 server');
        console.log('Sending GPS data string for processing');

        client.write(china_tk102_gpsstring + '\r\n');
        client.end();

        console.log('CTRL+C to exit');
    });
});

// start server
tk102.createServer({
    port: config.appPort
});
