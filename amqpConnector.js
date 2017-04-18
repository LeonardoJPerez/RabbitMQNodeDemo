const each = require('async/each');
const amqp = require('amqplib/callback_api');
const async = require('async');
const _ = require('lodash');

// if the connection is closed or fails to be established at all, we will reconnect
let _amqpConn = null;
let _config = null;

const buildHost = (config) => {
    if (config.username && config.password) {
        return `amqp://${_config.username}:${_config.password}@${_config.host}:${_config.port}/?heartbeat=${_config.heartbeat}`;
    } else {
        return '';
    }
}

const start = (config, processCb) => {
    if (!config) throw "Configuration object missing.";
    _config = _.assign({}, config);

    amqp.connect(buildHost(_config), (err, conn) => {
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

        whenConnected(processCb);
    });
}

const whenConnected = (processCb) => {
    // A worker that acks messages only if processed successfully.
    amqpConn.createChannel((err, ch) => {
        if (closeOnErr(err)) return;

        ch.on("error", (err) => {
            console.error("[AMQP] channel error", err.message);
        });

        ch.on("close", () => {
            console.log("[AMQP] channel closed");
        });

        ch.prefetch(_config.prefetch);

        var msgBlock = [];
        ch.assertQueue("UrisToProcess", { durable: true }, (err, _ok) => {
            if (closeOnErr(err)) return;

            ch.consume("UrisToProcess", processMsg, { noAck: false });
            console.log("Worker started");
        });

        const processMsg = (msg) => {
            if (msgBlock.length < _config.chunkSize) {
                msgBlock.push(msg);
                return;
            }

            console.log('Processing block of ' + msgBlock.length + 'messages.');

            async.each(msgBlock, (msg, callback) => {
                processCb(msg);

                callback(); // Callback is required for Async process to exit.
            }, (err) => {
                try {
                    if (err)
                        ch.nackAll();
                    else
                        ch.ackAll();
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

module.exports = { start };

