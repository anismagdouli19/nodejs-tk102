let config={};

config.appPort=1337;
//local MongoDB Server
config.mongoURL='mongodb://127.0.0.1:27017/dronerescue';
config.dbName='dronerescue';

config.finishTrackTimeOutInSeconds = 10; //time which should pass before finishing a track (in seconds)
config.trackWatcherIntervall = 10000; // in ms

config.log4js={
    appenders: {
        out: {type: 'console'},
        everything: {type: 'file', filename: './logs/connection-test.log', maxLogSize: 10485760, backups: 3, compress: true}
    },
    categories:{
        default: {appenders: ['out','everything'], level: 'info'}
    }
};
config.logLevel='DEBUG';

module.exports = config;
