const config = require('../config');
const events = require('events');
const log4js = require('log4js');
log4js.configure(config.log4js);
const logger = log4js.getLogger('TRACKSTORE');

/**
 * stores tracks in the form:
 *     [{
 *      imei: '353588102011094'
 *      gpsData: [
 *              {long: 12.123123, lat: 3423423},
 *              {long: 23.1233, lat: 22.234234}
 *            ],
 *      datetime: 1519722577980
 *     },
 *     {
 *      imei: '123423423542342'
 *      .
 *      .
 *      .
 *      .
 *
 *     }]
 *
 * @type {TrackStore}
 */
const TrackStore = class TrackStore {
    constructor() {
        this.tracks = [];
        this.tracks.gpsData = [];
        this.trackEmitter = new events.EventEmitter();
    }

    getTracks() {
        return this.tracks;
    }

    addData(data) {

        let foundIndex = this.tracks.findIndex(track => {
            if(track.imei) {
                return track.imei === data.imei;
            }
        });

        if (foundIndex >= 0) {
            this.tracks[foundIndex].gpsData.push(data.gpsData);
            clearTimeout(this.tracks[foundIndex].timeout);
            this.tracks[foundIndex].timeout = setTimeout(this.finishTrack, config.finishTrackTimeOutInSeconds, {
                this: this,
                trackIndex: foundIndex,
                emitter: this.trackEmitter
            });
            logger.info('added', JSON.stringify(data, null, 2), 'to existing track for imei:', this.tracks[foundIndex].imei);
        } else {
            let newTrack = Object.assign({}, data);
            data.gpsData = [];
            data.starttime = data.datetime;
            let index = this.tracks.push(data) - 1;
            this.tracks[index].gpsData.push(newTrack.gpsData);
            this.tracks[index].timeout = setTimeout(this.finishTrack, config.finishTrackTimeOutInSeconds, {
                this: this,
                trackIndex: index,
                emitter: this.trackEmitter
            });
            logger.info('added new track to trackstore', data);
        }
    }

    getEmitter() {
        return this.trackEmitter;
    }

    /**
     * determines if a running track is finished.
     * the method runs every config.trackWatcherIntervall seconds and starts with
     */
    watchTracks() {
        let nowMinusTimeout = new Date();
        nowMinusTimeout.setSeconds(nowMinusTimeout.getSeconds() - config.finishTrackTimeOutInSeconds);

        let finishedTracks = this.tracks.filter(track => {
            if (track.datetime <= nowMinusTimeout) {
                // remove finished tracks from tracks array
                this.tracks = this.tracks.filter(e => e !== track);
                track.endTime = Date.now();
                track.duration = track.endTime - track.startTime;
                return track;
            }
        });

        if (finishedTracks.length > 0) {
            this.trackEmitter.emit('finished', finishedTracks);
        }
    }

    /**
     * determines if a running track is finished.
     * the method runs every config.trackWatcherIntervall seconds and starts with
     */
    finishTrack(trackRef) {
        console.log('track is finished!');
        delete trackRef.this.tracks[trackRef.trackIndex].timeout;
        trackRef.this.tracks[trackRef.trackIndex].duration = trackRef.this.tracks[trackRef.trackIndex].datetime - trackRef.this.tracks[trackRef.trackIndex].datetime;
        trackRef.emitter.emit('finished', trackRef.this.tracks[trackRef.trackIndex]);
        delete trackRef.this.tracks[trackRef.trackIndex];
        //console.log(trackRef);
    }
};

module.exports = TrackStore;