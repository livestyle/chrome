/**
 * Browser popup UI controller: manages all popup connections
 * and sends updated data model
 */
'use strict';
import {getState, dispatch} from './';
import {normalizeUrl} from '../lib/utils';

const popupPorts = new Set();

/**
 * Default handler: sends popup model, created from given state, to all connected
 * popups
 * @param  {Object} state Storage data
 */
export default function(state) {
    popupPorts.forEach(port => sendPopupModel(port));
}

chrome.runtime.onConnect.addListener((port, sender) => {
    console.log('port connected', port, sender);
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
            onPopupConnect(port);
            sendPopupModel(port);
        });
    }
});

function sendPopupModel(port, state=getState()) {
    console.log('popup model', popupModelForTab(port.tabId, state));
    port.postMessage({
        action: 'model-update',
        data: popupModelForTab(port.tabId, state)
    });
}

function popupModelForTab(tabId, state) {
    var session = state.sessions[tabId];
    if (!session) {
        return {enabled: false};
    }

    var page = state.pages[session.page];
    return {
        enabled: page.enabled,
        direction: page.direction,
        editorFiles: state.editorFiles,
        browserFiles: session.stylesheets,
        mapping: session.mapping
    };
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

            dispatch({
                ...message.data,
                page: normalizeUrl(tab.url),
                tabId: tab.id
            });
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
