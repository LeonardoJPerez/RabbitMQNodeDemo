const each = require('async/each');
const amqp = require('amqplib/callback_api');
const async = require('async');
const snapshot = require('./snapshot');
const uuidV4 = require('uuid/v4');

const RabbitMQHost = '40.84.28.20';
const RabbitMQUserName = 'nbowman';
const RabbitMQPassword = 'password';

const options = {
    host: RabbitMQHost,
    port: 5672,
    prefetch: 10
};

console.log('Connecting to ' + options.host);

// if the connection is closed or fails to be established at all, we will reconnect
var amqpConn = null;

const localUrl = '';
const prodUrl = 'amqp://nbowman:password@40.84.28.20:5672/?heartbeat=60';

let count = 0;

const start = () => {
    amqp.connect(prodUrl, (err, conn) => {
        if (err) {
            console.error("[AMQP]", err.message);
            return setTimeout(start, 1000);
        }

        conn.on("error", (err) => {
            if (err.message !== "Connection closing") {
                console.error("[AMQP] conn error", err.message);
            }
        });

        conn.on("close", () => {
            console.error("[AMQP] reconnecting");
            return setTimeout(start, 1000);
        });

        console.log("[AMQP] connected");
        amqpConn = conn;

        whenConnected();
    });
}

const whenConnected = () => {
    // A worker that acks messages only if processed succesfully
    amqpConn.createChannel((err, ch) => {
        if (closeOnErr(err)) return;
        ch.on("error", (err) => {
            console.error("[AMQP] channel error", err.message);
        });

        ch.on("close", () => {
            console.log("[AMQP] channel closed");
        });

        ch.prefetch(options.prefetch);

        var msgBlock = [];
        ch.assertQueue("UrisToProcess", { durable: true }, (err, _ok) => {
            if (closeOnErr(err)) return;
            ch.consume("UrisToProcess", processMsg, { noAck: false });
            console.log("Worker started");
        });

        const processMsg = (msg) => {
            if (msgBlock.length < 9) {
                msgBlock.push(msg);
                return;
            }

            console.log('Processing block of ' + msgBlock.length + 'messages.');

            async.each(msgBlock, (msg, callback) => {
                console.log('Processing URL ' + msg.content.toString());
                const jsonMessage = JSON.parse(msg.content.toString());
                snapshot(jsonMessage.url, uuidV4(), (err) => {
                    if (err) console.log(err);
                    callback();
                });
            }, (err) => {
                try {
                    if (err)
                        ch.ackAll();
                    else
                        ch.nackAll();
                } catch (e) {
                    closeOnErr(e);
                } finally {
                    msgBlock = [];
                }
            });
        };
    });
}

const closeOnErr = (err) => {
    if (!err) return false;

    console.error("[AMQP] error", err);
    amqpConn.close();

    return true;
}

start();