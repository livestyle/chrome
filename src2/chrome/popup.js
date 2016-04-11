/**
 * Browser popup UI controller: manages all popup connections
 * and sends updated data model
 */
'use strict';
import {REMOTE_VIEW} from 'extension-app/lib/action-names';
import app from '../lib/app';
import {serialize} from '../lib/utils';
import {createSession, destroySession} from './remote-view';

const popupPorts = new Set();
const remoteViewActions = new Set([REMOTE_VIEW.SET_SESSION, REMOTE_VIEW.REMOVE_SESSION]);

/**
 * Default handler: sends popup model, created from given state, to all connected
 * popups
 * @param  {Object} state Storage data
 */
export default function(state) {
    popupPorts.forEach(sendPopupModel);
}

export function modelForTab(tabId, state=app.getState()) {
    var tab = state.tabs.get(tabId);
    var model = {
        enabled: false,
        tabId,
        url: tab.url,
        origin: tab.origin,
        remoteView: state.remoteView.sessions.get(tab.remoteView)
    };

    if (tab.session) {
        var session = state.sessions.get(tab.session.id);
        model = {
            ...model,
            enabled: session.enabled,
            direction: session.direction,
            editorFiles: serialize(state.editors.files),
            browserFiles: serialize(tab.session.stylesheets),
            mapping: serialize(tab.session.mapping),
            userStylesheets: serialize(tab.stylesheets.user) || {}
        };
    }
    return model;
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

function sendPopupModel(port) {
    port.postMessage({
        action: 'model-update',
        data: modelForTab(port.tabId)
    });
}

function onPopupMessage(message, port) {
    if (message && message.action === 'store-update') {
        // resolve session and page data for current connection then
        // apply action
        if (!port || !port.tabId) {
            return console.warn('Unknown port or tab id');
        }

        var data = message.data;
        if (remoteViewActions.has(data.type)) {
            if (data.type === REMOTE_VIEW.SET_SESSION) {
                createSession(port.tabId);
            } else if (data.type === REMOTE_VIEW.REMOVE_SESSION) {
                console.log('will close session for', port.tabId);
                destroySession(port.tabId);
            }
        } else {
            app.dispatch({...message.data, tabId: port.tabId});
        }
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
