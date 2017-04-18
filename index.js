const ampqConnector = require('./amqpConnector');
const snapshot = require('./snapshot');
const uuidV4 = require('uuid/v4');

const options = {
    heartbeat: 60,
    //host: '40.84.28.20',
    host: 'localhost',
    port: 5672,
    prefetch: 10,
    // username: 'nbowman',
    // password: 'password',
    reconnectTime: 1000,
    chunkSize = 2
};

console.log('Connecting to ' + options.host);

const messageHandler = (msg) => {
    console.log('Processing URL ' + msg.content.toString());

    const jsonMessage = JSON.parse(msg.content.toString());
    snapshot(jsonMessage.Uri, uuidV4(), (err) => {
        if (err) console.log(err);
        callback();
    });
};

ampqConnector.start(options, messageHandler);