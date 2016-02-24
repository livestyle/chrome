/**
 * A background page controller for handling all interactions with
 * DevTools Resources
 */
'use strict';
import EventEmitter from 'eventemitter3';

const ports = new Map();
const stylesheetMap = new Map();
const locks = new Set();
const emitter = new EventEmitter();

export function on(...args) {
    return emitter.on(...args);
}

export function once(...args) {
    return emitter.once(...args);
}

export function off(...args) {
    return emitter.off(...args);
}

/**
 * Check if given resource is locked for update transaction
 * @param  {String} url
 */
export function isLocked(url) {
    return locks.has(url);
}

/**
 * Check if there’s a resource with URL
 * @param  {String}  url
 * @return {Boolean}
 */
export function has(url) {
    return stylesheetMap.has(url);
}

/**
 * Sets `content` of resource with given URL in all connected DevTools.
 * Returns Promise which is resolved when resource in all connected DevTools.
 * @param  {String} url
 * @param  {String} content
 * @return {Promise}
 */
export function update(url, content) {
    if (!has(url)) {
        // no such resource in connected DevTools, abort
        return Promise.resolve();
    }

    lock(url);
    var ports = Array.from(stylesheetMap.get(url));
    return Promise.all(ports.map(port => updateResource(port, url, content)))
    .then(values => {
        unlock(url);
        console.log('all devtools instances are updated', url);
    });
}

/**
 * Returns list of DevTools stylesheets associated with DevTools of given `tabId`
 * @param  {Number} tabId
 * @return {Array}
 */
export function stylesheets(tabId) {
    var port;
    ports.forEach((value, key) => {
        if (value === tabId) {
            port = key;
        }
    });

    if (port) {
        return Array.from(stylesheetMap.entries())
        .reduce((out, [url, portSet]) => {
            if (portSet.has(port)) {
                out.push(url);
            }
            return out;
        }, []);
    }
}

chrome.runtime.onConnect.addListener(port => {
    var [name, tabId] = port.name.split(':');
    if (name === 'devtools') {
        ports.set(port, +tabId);
        port.onMessage.addListener(onPortMessage);
        port.onDisconnect.addListener(onPortDisconnect);
        emitter.emit('connect', port);
        console.log('devtools connected %s, total connection: %d', port.name, ports.size);
    }
});

function onPortMessage(message, port) {
    var {action, data} = message;
    console.log('%c[DevTools]%c received message %c%s %con port %s', 'background-color:#344a5d;color:#fff', '', 'font-weight:bold;', action, '', port.name);
    switch (action) {
        case 'resource-list':
            return updateStylesheetList(port, data.items);
        case 'resource-updated':
            return onResourceUpdate(port, data);
        case 'request-updated-content':
            // A DevTools just requested the latest content for resources.
            // Assuming that all newly connected DevTools instances request
            // updated content, eventually *all* already connected DevTools
            // will have the same content for same resources.
            // So, in order to get the most recent resource content, simply fetch
            // if from port that is not given `port`
            return data.items.forEach(url => {
                if (stylesheetMap.has(url)) {
                    Array.from(stylesheetMap.get(url)).some(subport => {
                        if (subport !== port) {
                            return getResourceContent(subport, url)
                            .then(content => {
                                lock(url);
                                return updateResource(port, url, content);
                            })
                            .then(() => unlock(url))
                            .catch(error => {
                                unlock(url);
                                console.error('Error while sending most recent content to', url, error);
                            });
                        }
                    })
                }
            });
    }
}

function onPortDisconnect(port) {
    removeStylesheetPortMappings(port);
    port.onMessage.removeListener(onPortMessage);
    port.onDisconnect.removeListener(onPortDisconnect);
    ports.delete(port);
    emitter.emit('disconnect', port);
    console.log('devtools %s disconnected, total connection: %d', port.name, ports.size);
}

/**
 * Updates list of DevTools resources and their port mappings. Each
 * stylesheet entry contains reference to all DevTools port connections
 * that contains this resource
 * @param  {Port} port
 * @param  {Array} stylesheets
 */
function updateStylesheetList(port, stylesheets) {
    // first, clear all port mappings from given port to clear
    // removed resources
    removeStylesheetPortMappings(port);
    if (!Array.isArray(stylesheets)) {
        stylesheets = [stylesheets];
    }
    stylesheets
    .filter(Boolean)
    .forEach(url => {
        if (!stylesheetMap.has(url)) {
            stylesheetMap.set(url, new Set());
        }
        stylesheetMap.get(url).add(port);
    });
    onListUpdate();
}

/**
 * Remove given port mapping from stylesheets
 * @param  {Port} port
 */
function removeStylesheetPortMappings(port) {
    stylesheetMap.forEach((ports, url) => {
        ports.delete(port);
        if (!ports.size) {
            stylesheetMap.delete(url);
        }
    });
    onListUpdate();
}

/**
 * Handles incoming resource update that occured when user updated resource
 * in DevTools or LiveStyle forced resource update
 * @param  {Port} port
 * @param  {Object} res  Resource descriptor
 */
function onResourceUpdate(port, res) {
    if (isLocked(res.url)) {
        console.log('updated resource is locked, do nothing');
        return;
    }

    // Update resource content in all connected DevTools including one that
    // initiated this call to force update resources in embedded iframes as well
    // (required for Re:view)
    // TODO check if Re:view enabled and filter port if disabled?
    emitter.emit('update', res.url, res.content);
    update(res.url, res.content);
}

/**
 * Updates content of resource for given URL in connected DevTools instance,
 * identified by `port` connection. Returns a Promise that resolved
 * when resource is fully updated
 * @param  {Port} port
 * @param  {String} url
 * @param  {String} content
 * @return {Promise}
 */
function updateResource(port, url, content) {
    return request(port, 'update-resource', ['url'], {url, content})
    .catch(error => ({error}));
}

/**
 * Fetches resource content for given URL from DevTools instance connected by `port`
 * @param  {Port} port
 * @param  {String} url
 * @return {Promise}
 */
function getResourceContent(port, url) {
    return request(port, 'get-resource-content', ['url'] , {url})
    .then(resp => resp.content);
}

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
function request(port, messageName, idKeys, payload) {
    return new Promise((resolve, reject) => {
        var onComplete = (err, data) => {
            err ? reject(err) : resolve(data);
            port.onMessage.removeListener(onMessage);
            port.onDisconnect.removeListener(onDisconnect);
        };
        var onMessage = message => {
            // we send a `messageName` request to port and wait for the same massage
            // in response, which means transaction is complete
            if (message.action === messageName) {
                // make sure request and response data matches
                let isValidResponse = idKeys.reduce((r, key) => r && message.data[key] === payload[key], true);
                if (isValidResponse) {
                    console.log('%c   ««« %c%s %c%s', 'color:red;font-weight:bold;font-size:1.2em', 'font-weight:bold;', messageName, 'color:gray;', port.name);
                    onComplete(null, message.data);
                }
            }
        };
        var onDisconnect = () => {
            var error = new Error('Port is disconnected');
            error.code = 'EPORTDISCONNECT';
            onComplete(error);
        };

        port.onMessage.addListener(onMessage);
        port.onDisconnect.addListener(onDisconnect);

        console.log('%c   »»» %c%s %c%s', 'color:red;font-weight:bold;font-size:1.2em', 'font-weight:bold;', messageName, 'color:gray;', port.name);
        port.postMessage({
            action: messageName,
            data: payload
        });

        // for unexpected errors
        setTimeout(() => {
            var error = new Error('DevTools response timed out');
            error.code = 'EPORTTIMEOUT';
            onComplete(error);
        }, 10000);
    });
}


function onListUpdate() {
    emitter.emit('list-update', Array.from(stylesheetMap.keys()));
}

/**
 * Locks given resource for update transaction. If it’s locked, all incoming
 * events or updates for this resource will be ignored
 * @param  {String} url
 * @return
 */
function lock(url) {
    console.log('locking', url);
    locks.add(url);
}

/**
 * Removes resource lock for given URL
 * @param  {String} url
 */
function unlock(url) {
    console.log('unlocking', url);
    locks.delete(url);
}
