/*
Name:         tk102
Description:  TK102 GPS server for Node.js
Author:       Franklin van de Meent (https://frankl.in)
Source:       https://github.com/fvdm/nodejs-tk102
Feedback:     https://github.com/fvdm/nodejs-tk102/issues
License:      Unlicense (Public Domain, see UNLICENSE file)
              <https://github.com/fvdm/nodejs-tk102/raw/master/UNLICENSE>
*/

const net = require('net');
const EventEmitter = require('events').EventEmitter;
const tk102 = new EventEmitter();

// device data
const specs = [
    function (data) {
        // 1203292316,0031698765432,GPRMC,211657.000,A,5213.0247,N,00516.7757,E,0.00,273.30,290312,,,A*62,F,imei:123456789012345,123
        let text = data.text;
        let result = null;
        let str = [];
        let datetime = '';
        let gpsdate = '';
        let gpstime = '';

        try {
            text = text.trim();
            str = text.split(',');

            if (str.length === 18 && str [2] === 'GPRMC') {
                datetime = str [0].replace(/([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{2})/, function (s, y, m, d, h, i) {
                    return '20' + y + '-' + m + '-' + d + ' ' + h + ':' + i;
                });

                gpsdate = str [11].replace(/([0-9]{2})([0-9]{2})([0-9]{2})/, function (s, d, m, y) {
                    return '20' + y + '-' + m + '-' + d;
                });

                gpstime = str [3].replace(/([0-9]{2})([0-9]{2})([0-9]{2})\.([0-9]{3})/, function (s0, h, i, s, ms) {
                    return h + ':' + i + ':' + s + '.' + ms;
                });

                result = {
                    raw: text,
                    datetime: datetime,
                    phone: str [1],
                    gps: {
                        date: gpsdate,
                        time: gpstime,
                        signal: str [15] === 'F' ? 'full' : 'low',
                        fix: str [4] === 'A' ? 'active' : 'invalid'
                    },
                    geo: {
                        latitude: tk102.dmm2ddd(str [5], str [6]),
                        longitude: tk102.dmm2ddd(str [7], str [8]),
                        bearing: parseInt(str [10], 10)
                    },
                    speed: {
                        knots: Math.round(str [9] * 1000) / 1000,
                        kmh: Math.round(str [9] * 1.852 * 1000) / 1000,
                        mph: Math.round(str [9] * 1.151 * 1000) / 1000
                    },
                    imei: str [16].replace('imei:', ''),
                    checksum: tk102.checksum(text)
                };
            }
        } catch (e) {
            result = null;
        }

        return result;
    }
];


const specsLKGPS = [
    function (data) {
        // 1203292316,0031698765432,GPRMC,211657.000,A,5213.0247,N,00516.7757,E,0.00,273.30,290312,,,A*62,F,imei:123456789012345,123
        // *HQ,8120016933,V1,141825,A,4706.0098,N,01525.4893,E,001.00,247,280218,FFFFFBFF,232,01,0,0,3#
        // *HQ,8120016933,V1,103655,V,4706.0288,N,01525.4578,E,000.00,000,080318,FFFDF9FE,232,01,0,0,2#
        let text = data.text;
        let result = null;
        let str = [];
        let datetime = '';
        let gpsdate = '';
        let gpstime = '';

        try {
            text = text.trim();
            str = text.split(',');

            // only interpret valid ('A') location data packets ('V1')
            if (str.length >= 18 && str[0] === '*HQ' && str[2] === 'V1' && str[4] === 'A') {
                datetime = Date.now();
                // TODO hhmmss: datetime = str[3]  ddmmyy: str[11]

                result = {
                    raw: text,
                    datetime: datetime,
                    geo: {
                        longitude: tk102.dmm2ddd(str[7], str [8]),
                        latitude: tk102.dmm2ddd(str [5], str[6])
                    },
                    imei: str [1]
                };
            }

        } catch (e) {
            result = null;
        }

        return result;
    }
];

const specsLKGPSbinary = [
    function (data) {
        // <Buffer 24 81 20 01 69 33 08 39 46 22 03 18 47 05 94 04 03 01 52 55 25 0e 00 00 00 ff ff f9 ff ff 00 12 00 00 00 00 00 00 e8 01 00 00 00 00 01>
        // to hex String:
        // 2481200169330908342203184706026803015254720e000180fffff9ffff0012060000000000e8010000000008
        // 24 8120016933 090834 220318 47060268 03 015254720e 000180 fffff9ff ff00 12 06 00000000 00e8 01 0000 0000 08
        // 24 ... $
        // 8120016933 ... imei
        // 090834 ... time
        // 220318 ... date
        // 47060268 ... latitude
        // 03 ... reserve or battery level
        // 015254720e ... Longitude,N,E,AV
        //      longitude: 01525.4720   e: 1110  =>  bit0:  not defined
        //                                           bit1:  1:A, 0:V
        //                                           bit2:  1: north lat, 0: south lat
        //                                           bit3:  1: east long, 0: west long
        // 000180 ... Speed, direction
        // fffff9ff ... vehicle_status
        // ff00 ... user_alarm_flag
        // 12 ... reserve (or GSM signal 1 - 31)
        // 06 ... gps signal
        // 00000000 ... GPS mileage unit: kilometer
        // 00e8 ... country code
        // 01 ... operators number
        // 0000 ... station number
        // 0000 ... Cell Id
        // 08 ... operator number
        //
        // valid: 24 8120016933 103007 220318 47060316 03 015254600e 000141 fffff9ffff0010770000000000e8010000000016

        let raw = data.raw;
        let result = null;
        let str = [];
        let datetime = '';
        let gpsdate = '';
        let gpstime = '';

        /*
        console.log('hello, im reporting from specsLKGPSbinary... here come the news!');
        console.log(raw);
        console.log(raw.length);
        console.log('HERE COMES A HEX STRING');
        console.log(data.raw.toString('hex'));
*/
        result = raw;

        if (raw.length < 22) {
            return null;
        }

        /*
        let direction = raw.slice(0x15, 0x16);
        console.log(direction);
        let lastDigitLongitude = direction[0] >>> 4;
        console.log(lastDigitLongitude);
        console.log(direction[0] & 0x0f);
*/

        try {

            //str = text.split(',');
            /*
            HERE COMES A HEX STRING
            2481200169331518452203184706017906015254870c000045fffff9ffff0013000000000000e801000000001f
            <Buffer 0c>
            0
            12
            PFUSCH: 12
            0
            0
            IT IS EAST
            IT IS NORTH

             */

            let pfusch = (raw.slice(0x15, 0x16)[0]) & 0x0f;
/*
            console.log('PFUSCH: ' + pfusch);
            console.log('masked PFUSCH: ' + (pfusch & 0x08));
            console.log('masked PFUSCH: ' + (pfusch & 0x04));
            console.log('PFUSCH: ' + pfusch);


            if ((pfusch & 0x08) != 0) {
                console.log('IT IS EAST');
            } else {
                console.log('IT IS WEST');
            }

            if ((pfusch & 0x04) != 0) {
                console.log('IT IS NORTH');
            } else {
                console.log('IT IS SOUTH');
            }

            if ((pfusch & 0x02) != 0) {
                console.log('IT IS A');
            } else {
                console.log('IT IS V');
            }
*/

            let latDir = (pfusch & 0x04) ? 'N' : 'S';
            let longDir = (pfusch & 0x08) ? 'E' : 'W';
            let validGps = (pfusch & 0x02) ? true : false;

            let lastDigitLongitude = (raw.slice(0x15, 0x16)[0]) >>> 4;



            result = {
                // 24 ... $
                // 8120016933 ... imei
                // 090834 ... time
                // 220318 ... date
                // 47060268 ... latitude
                // 03 ... reserve or battery level
                // 015254720e ... Longitude,N,E,AV
                // 000180 ... Speed, direction
                // fffff9ff ... vehicle_status
                // ff00 ... user_alarm_flag
                // 12 ... reserve (or GSM signal 1 - 31)
                // 06 ... gps signal
                // 00000000 ... GPS mileage unit: kilometer
                // 00e8 ... country code
                // 01 ... operators number
                // 0000 ... station number
                // 0000 ... Cell Id
                // 08 ... operator number
                raw: raw.toString('hex'),
                imei: raw.slice(0x01,0x06).toString('hex'),
                datetime : Date.now(),
                geo: {
                    //PAJ Format: 4706.0414 N 01525.4367 E
                    latitude: tk102.dmm2ddd(raw.slice(0x0c, 0x0e).toString('hex') + '.' + raw.slice(0x0e, 0x10).toString('hex'), latDir),
                    longitude: tk102.dmm2ddd(raw.slice(0x11, 0x13).toString('hex') + '.' + raw.slice(0x13, 0x15).toString('hex') + lastDigitLongitude.toString('hex'), longDir)
                },
                valid: validGps
            };



        } catch (e) {
            result = null;
        }

        console.log(result);

        return result;
    }
];

const specsDrs = [
    function (data) {
        // #353588102011094##1#0000#AUT#01#2320011dbf9ac0#1525.570600,E,4706.119300,N,0.00,0.00#260218#091514.000##
        let text = data.text;
        let result = null;
        let str = [];
        let datetime = '';

        try {
            text = text.trim();
            str = text.split('#');

            if (str.length === 13) {
                datetime = Date.now();
                let gpsData = str[8].split(',');

                result = {
                    raw: text,
                    datetime: datetime,
                    geo: {
                        longitude: tk102.dmm2ddd(gpsData [0], gpsData [1]),
                        latitude: tk102.dmm2ddd(gpsData [2], gpsData [3])
                    },
                    imei: str [1]
                };
            }
        } catch (e) {
            result = null;
        }

        return result;
    }
];


// defaults
tk102.settings = {
    ip: '0.0.0.0',
    port: 0,
    connections: 10,
    //timeout: 10
};


/**
 * Emit an event
 * and duplicate to 'log' event
 *
 * @param   {string}  name   Event name
 * @param   {string}  value  Event value
 * @return  {void}
 */

tk102.event = function (name, value) {
    tk102.emit(name, value);
    tk102.emit('log', name, value);
};


/**
 * Catch uncaught exceptions (server kill)
 *
 * @param   {Error}  err  Error cause
 * @return  {void}
 */

process.on('uncaughtException', function (err) {
    let error = new Error('uncaught exception');

    error.error = err;
    console.log(error);
    tk102.event('error', error);
});


/**
 * Create server
 *
 * @param   {object}  [vars]                 Override default settings
 * @param   {string}  [vars.ip='0.0.0.0']    Listen on IP
 * @param   {number}  [vars.port=0]          Listen on port, `0` = random
 * @param   {number}  [vars.connections=10]  Max server connections
 * @param   {number}  [vars.timeout=10]      Socket timeout in seconds
 * @return  {object}  tk102                  The server
 */

tk102.createServer = function (vars) {
    let key;

    // override settings
    if (typeof vars === 'object' && Object.keys(vars).length >= 1) {
        for (key in vars) {
            tk102.settings [key] = vars [key];
        }
    }

    // start server
    tk102.server = net.createServer();

    // maximum number of slots
    tk102.server.maxConnections = tk102.settings.connections;

    // server started
    tk102.server.on('listening', function () {
        tk102.event('listening', tk102.server.address());
    });

    // inbound connection
    tk102.server.on('connection', function (socket) {
        let connection = tk102.server.address();

        connection.remoteAddress = socket.remoteAddress;
        connection.remotePort = socket.remotePort;

        tk102.event('connection', connection);

        if (tk102.settings.timeout > 0) {
            socket.setTimeout(parseInt(tk102.settings.timeout * 1000, 10));
        }

        socket.on('timeout', function () {
            tk102.event('timeout', connection);
            socket.destroy();
        });

        socket.on('data', function (raw) {

            let data = {};
            data.raw = raw;
            data.text = raw.toString('binary');
            data.text = data.text.trim();

            tk102.event('data', data);

            if (data.text !== '') {
                const gps = tk102.parse(data);

                if (gps) {
                    tk102.event('track', gps);
                } else {
                    /*
                    err = new Error('Cannot parse GPS data from device');
                    err.reason = err.message;
                    err.input = data;
                    err.connection = connection;
                    */

                    let err = 'Cannot parse telegramm: ' + data;

                    tk102.event('fail', err);
                }
            }
        });

        socket.on('close', function (hadError) {
            connection.hadError = hadError;
            tk102.event('disconnect', connection);
        });

        // error
        socket.on('error', function (error) {
            let err = new Error('Socket error');

            err.reason = error.message;
            err.socket = socket;
            err.settings = tk102.settings;

            tk102.event('error', err);
        });
    });

    tk102.server.on('error', function (error) {
        let err = new Error('Server error');

        if (error === 'EADDRNOTAVAIL') {
            err = new Error('IP or port not available');
        }

        err.reason = error.message;
        err.input = tk102.settings;

        tk102.event('error', err);
    });

    // Start listening
    tk102.server.listen(tk102.settings.port, tk102.settings.ip);

    return tk102;
};


/**
 * Graceful close server
 *
 * @callback  callback
 * @param     {function}  callback  `(err)`
 * @return    {void}
 */

tk102.closeServer = function (callback) {
    if (!tk102.server) {
        callback(new Error('server not started'));
        return;
    }

    tk102.server.close(callback);
};


/**
 * Parse GPRMC string
 *
 * @param   {string}  raw   Command text from device
 * @return  {object}  data  Parsed data
 */
tk102.parse = function (data) {
    let processedData = null;
    let i = 0;

    let parsedData = [];
    if (data.text.charAt(0) === '#') {
        parsedData = specsDrs;
    } else if (data.text.charAt(0) === '*') {
        parsedData = specsLKGPS;
    } else if (data.text.charAt(0) === '$') {
        // I dont know why.. but paj also uses just binary data...
        // $ heading indicates a pure binary message
        parsedData = specsLKGPSbinary;
    } else {
        parsedData = specs;
    }

    while (processedData === null && i < parsedData.length) {
        processedData = parsedData [i](data);
        i++;
    }

    return processedData;
};


/**
 * Converts a DMM coordinate to a DDD coordinate
 * The DDD coordinate has to be in the format 'DDDMM.MMMM' respectively 'DDMM.MMMM' for latitude.
 * This method was specifically written for the PAJ GPS Tracker, which encodes the coordinates as described above.
 * Works also with original TK102.
 *
 * Example conversion:
 *    PAJ Format: 4706.0414 N 01525.4367 E
 *       ↓
 *    DM.m: 47 06.0414 N  15 25.4367 E
 *      ↓
 *    D.d: 47.10069 15.423945
 *
 * @param   {string}  dmm           Geo position DMM
 * @param   {string}  direction     Geo direction: N W S E
 * @return  {float}                 Decimal geo position
 */
tk102.dmm2ddd = function (dmm, direction) {
    console.log('dmm2dd input:', dmm, direction);
    const minutes = dmm.substr(-7, 7);
    const degrees = parseInt(dmm.replace(minutes, ''), 10);

    let result = degrees + (minutes / 60);
    result = parseFloat((direction === 'S' || direction === 'W' ? '-' : '') + result);

    result = Math.round(result * 1000000) / 1000000;

    return result;
};


/**
 * Check checksum in raw string
 *
 * @param   {string}   raw    Command text from device
 * @return  {boolean}  check  Checksum result
 */

tk102.checksum = function (raw) {
    let str = raw.trim()
        .split(/[,*#]/);
    let strsum = parseInt(str [15], 10);
    let strchk = str.slice(2, 15)
        .join(',');
    let check = 0;
    let i;

    for (i = 0; i < strchk.length; i++) {
        check ^= strchk.charCodeAt(i);
    }

    check = parseInt(check.toString(16), 10);
    return (check === strsum);
};


// ready
module.exports = tk102;
