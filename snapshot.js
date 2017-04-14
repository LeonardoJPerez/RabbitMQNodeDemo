const fs = require('fs');
const webshot = require('./node_modules/node-webshot-master/lib/webshot');

module.exports = (url: string, id: string, cb: function) => {
    const options = {
        defaultWhiteBackground: true,
        renderDelay: 5000,
        windowSize: {
            width: 1300,
            height: 2500
        }
    };

    webshot(url, `${id}.png`, options, (err) => {
        cb(err);
    });
};