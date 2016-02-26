/**
 * Synchronizes active sessions list for given store state with currently opened
 * tabs in Chrome
 */
'use strict';
import {dispatch, getState} from './store';
import {SESSION} from './action-names';
import {normalizeUrl} from '../lib/utils';

var pending = false;

export default function() {
    if (pending) {
        return;
    }

    pending = true;
    chrome.tabs.query({
        windowType: 'normal',
        status: 'complete'
    }, tabs => {
        pending = false;
        var {pages, sessions} = getState();
        dispatch({
            type: SESSION.UPDATE_LIST,
            sessions: updateSessions(tabs, pages, sessions)
        });
    });
}

/**
 * Updates session list to match current state of active pages model
 * @param  {Array} tabs      Currently opened tabs
 * @param  {Object} pages    Active page models
 * @param  {Object} sessions Current tab sessions
 * @return {Object} Either given `sessions` object (if no changes) or new object
 * with sessions
 */
function updateSessions(tabs, pages, sessions) {
    let pageUrls = new Set(Object.keys(pages));
    let currentTabIds = new Set(tabs.map(tab => tab.id));

    // Check if we have to remove some sessions. Reasons to remove:
    // - tab was closed
    // - user explicitly disabled LiveStyle for page
    let removed = Object.keys(sessions).filter(tabId => {
        var page = pages[sessions[tabId].page];
        return !page || !page.enabled || !currentTabIds.has(+tabId);
    });

    // Check for new sessions
    let added = tabs.filter(tab => !(tab.id in sessions) && pageUrls.has(normalizeUrl(tab.url)));

    if (removed.length || added.length) {
        sessions = {...sessions};
        removed.forEach(tabId => delete sessions[tabId]);
        added.forEach(tab => {
            sessions[tab.id] = {
                page: normalizeUrl(tab.url),
                stylesheets: [],
                cssomStylesheets: null,
                devtoolsStylesheets: null,
                mapping: {},
                autoMapping: {},
                patches: new Map()
            };
        });
    }

    return sessions;
}
