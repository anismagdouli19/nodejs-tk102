/*
  Start with:  node example.js
  Telnet to:   telnet 127.0.0.1 1337
  Copy/paste:  1203292316,0031698765432,GPRMC,211657.000,A,5213.0247,N,00516.7757,E,0.00,273.30,290312,,,A*62,F,imei:123456789012345,123
*/

var tk102 = require('./lib/tk102');
var net = require('net');

const original_tk102_teststring = '1203292316,0031698765432,GPRMC,211657.000,A,5213.0247,N,00516.7757,E,0.00,273.30,290312,,,A*62,F,imei:123456789012345,123';
const paj_teststring = '*HQ,8120016933,V1,141825,A,4706.0098,N,01525.4893,E,001.00,247,280218,FFFFFBFF,232,01,0,0,3#';

// fancy console log
function output(data) {
    console.log('\nIncoming GPS data:\n');
    console.dir(data, {
        colors: String(process.env.TERM)
            .match(/color$/)
    });
}

// report only track event to console
tk102.on('data', output);

tk102.on('track', output);

/*
tk102.on ('log', function(name, value) {
  console.log('Event:', name);
  console.log(value);
});
*/

// wait for server to be ready
tk102.on('listening', function (lst) {
    var client;

    console.log('TK102 server is ready');

    // Send data with telnet
    client = net.connect(lst.port, function () {
        console.log('Connected to TK102 server');
        console.log('Sending GPS data string for processing');

        client.write(gps + '\r\n');
        client.end();

        console.log('CTRL+C to exit');
    });

    var clientDrs;

    clientDrs = net.connect(1338, function () {
        console.log('Connected to TK102 server');
        console.log('Sending GPS data string for processing');

        clientDrs.write(paj_teststring + '\r\n');
        clientDrs.end();

        console.log('CTRL+C to exit');
    });

});

// start server
tk102.createServer({
    port: 1338
});
