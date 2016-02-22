'use strict';

const cp = require('child_process');

module.exports = function(title) {
    return err => {
        if (process.platform === 'darwin') {
            console.log('log message', err.message, title);
            cp.exec(`osascript -e 'display notification "${err.message.replace(/"/g, '\\"')}" with title "${title}"'`);
        }
    };
};
