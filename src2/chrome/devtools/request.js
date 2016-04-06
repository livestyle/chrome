/**
 * Generic request/response method: sends `messageName` message with `payload`
 * data to given `port` and waits until `port` responds with the same message
 * and content where values of `idKeys` equal to ones from `payload`
 * @param  {Port} port
 * @param  {String} messageName
 * @param  {Array} idKeys
 * @param  {Object} payload
 * @return {Promise}
 */
'use strict';
import {error} from '../../lib/utils';

export default function request(port, messageName, idKeys=[], payload=null) {
    return new Promise((resolve, reject) => {
        var onComplete = (err, data) => {
            port.onMessage.removeListener(onMessage);
            port.onDisconnect.removeListener(onDisconnect);
            err ? reject(err) : resolve(data);
        };
        var onMessage = message => {
            // we send a `messageName` request to port and wait for the same massage
            // in response, which means transaction is complete
            if (isValidResponse(messageName, idKeys, payload, message)) {
                // make sure request and response data matches
                console.log('%c   ««« %c%s %c%s', 'color:red;font-weight:bold;font-size:1.2em', 'font-weight:bold;', messageName, 'color:gray;', port.name);
                onComplete(null, message.data);
            }
        };
        var onDisconnect = () => onComplete(error('EPORTDISCONNECT', 'Port is disconnected'));

        port.onMessage.addListener(onMessage);
        port.onDisconnect.addListener(onDisconnect);

        console.log('%c   »»» %c%s %c%s', 'color:red;font-weight:bold;font-size:1.2em', 'font-weight:bold;', messageName, 'color:gray;', port.name);
        port.postMessage({
            action: messageName,
            data: payload
        });

        // for unexpected errors
        setTimeout(() => onComplete(error('EPORTTIMEOUT', 'DevTools response timed out')), 10000);
    });
}

function isValidResponse(name, idKeys, req, res) {
    if (res.action === name) {
        if (!idKeys || !idKeys.length) {
            return true;
        }
        req = req || {};
        return idKeys.reduce((r, key) => r && res.data[key] === req[key], true);
    }
}
