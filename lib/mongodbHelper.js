const config = require('../config');
const MongoClient = require('mongodb').MongoClient;
const log4js = require('log4js');
log4js.configure(config.log4js);
const logger = log4js.getLogger('TRACKING');


// Create the database connection
let db;
MongoClient.connect(config.mongoURL, {poolSize: 25})
    .then((mongodb) => {
        logger.info('Database connection pool set up!');
        db = mongodb.db(config.dbName);
    })
    .catch((err) => logger.error(err));


module.exports.insertDocument = function insertDocument(collectionName, insertobj) {
    const collection = db.collection(collectionName);

    return new Promise((resolve, reject) => {
        collection.insertOne(insertobj, {w: 1})
            .then((result) => {
                resolve(result);
            })
            .catch((err) => {
                reject(new Error(err));
            });
    });
};

module.exports.findDocuments = function findDocuments(collectionName, searchobj) {
    const collection = db.collection(collectionName);

    return new Promise((resolve, reject) => {
        collection.find(searchobj)
            .toArray((err, docs) => {
                if (err) reject(err);
                logger.info('FIND in ' + collectionName + ' completed successfully!');
                resolve(docs);
            })
    });
};