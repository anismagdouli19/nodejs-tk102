const tk102 = require('./lib/tk102');
const net = require('net');

const paj_teststring = '*HQ,1203292316,V1,141825,A,4706.0098,N,01525.4893,E,001.00,247,280218,FFFFFBFF,232,01,0,0,3#';


tk102.on('log', function (name, value) {
    const date = new Date();
    console.log('\n' + date.toString());

    console.log('Event:', name);
    console.log(value);
});


// wait for server to be ready
tk102.on('listening', function (lst) {
    console.log('TK102 server is ready');

    /*
    client = net.connect(lst.port, function () {
        console.log('Connected to TK102 server');
        console.log('Sending GPS data string for processing');

        client.write(paj_teststring + '\r\n');
        client.end();

        console.log('CTRL+C to exit');
    });
    */
});

// start server
tk102.createServer({
    port: 1337
});
