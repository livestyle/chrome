/**
 * Browser popup UI controller: manages all popup connections
 * and sends updated data model
 */
'use strict';
import {getState, dispatch} from '../app/store';
import {REMOTE_VIEW} from '../app/action-names';
import {createSession, removeSession} from '../app/remote-view';
import {normalizeUrl} from '../lib/utils';

const popupPorts = new Set();
const EMPTY_OBJECT = {};
const mainFrame = {frameId: 0};
const remoteViewActions = new Set([REMOTE_VIEW.CREATE_SESSION, REMOTE_VIEW.REMOVE_SESSION]);

/**
 * Default handler: sends popup model, created from given state, to all connected
 * popups
 * @param  {Object} state Storage data
 */
export default function(state) {
    popupPorts.forEach(port => sendPopupModel(port));
}

chrome.runtime.onConnect.addListener((port, sender) => {
    if (port.name === 'popup') {
        // assign current tab id to explicitly identify session
        chrome.tabs.query({
            active: true,
            windowType: 'normal',
            currentWindow: true
        }, ([tab]) => {
            if (!tab) {
                return console.error('No active tab for connected popup');
            }

            port.tabId = tab.id;
            port.url = tab.url;
            onPopupConnect(port);
            sendPopupModel(port);
        });
    }
});

function sendPopupModel(port, state=getState()) {
    fetchOrigin(port.tabId).then(origin => {
        port.postMessage({
            action: 'model-update',
            data: popupModelForPort(port, origin, state)
        });
    });
}

function popupModelForPort(port, origin, state) {
    var session = state.sessions[port.tabId];
    var model = {
        enabled: false,
        tabId: port.tabId,
        url: port.url,
        origin,
        remoteView: state.remoteView.sessions.get(origin)
    };

    if (session) {
        var page = state.pages[session.page];
        var userStylesheets = {};
        (session.userStylesheets || new Map()).forEach((value, key) => userStylesheets[value] = key);
        model = {
            ...model,
            enabled: page.enabled,
            direction: page.direction,
            editorFiles: state.editorFiles,
            browserFiles: session.stylesheets,
            mapping: session.mapping,
            userStylesheets
        };
    }
    return model;
}

function onPopupMessage(message, port) {
    if (message && message.action === 'store-update') {
        // resolve session and page data for current connection then
        // apply action
        if (!port || !port.tabId) {
            return console.warn('Unknown port or tab id');
        }

        chrome.tabs.get(port.tabId, tab => {
            if (!tab) {
                return console.warn('No tab for', port.tabId);
            }

            var data = message.data;
            if (remoteViewActions.has(data.type)) {
                fetchOrigin(tab.id).then(origin => {
                    if (data.type === REMOTE_VIEW.CREATE_SESSION) {
                        createSession(origin);
                    } else if (data.type === REMOTE_VIEW.REMOVE_SESSION) {
                        console.log('will close session', origin);
                        removeSession(origin);
                    }
                });
            } else {
                dispatch({
                    ...message.data,
                    page: normalizeUrl(tab.url),
                    tabId: tab.id
                });
            }
        });
    }
}

function onPopupConnect(port) {
    port.onMessage.addListener(onPopupMessage);
    port.onDisconnect.addListener(onPopupDisconnect);
    popupPorts.add(port);
}

function onPopupDisconnect(port) {
    port.onMessage.removeListener(onPopupMessage);
    port.onDisconnect.removeListener(onPopupDisconnect);
    popupPorts.delete(port);
}

function fetchOrigin(tabId) {
    return new Promise(resolve => {
        chrome.tabs.sendMessage(tabId, {action: 'get-origin'}, mainFrame, resolve);
    });
}
