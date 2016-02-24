/**
 * Applies given diff to all active sessions
 */
'use strict';
import {getState} from './store';
import {PAGE} from './action-names';
import {keyForValue} from '../lib/utils';

/**
 * Returns array of payloads that should be applied on editor files for given
 * diff
 * @param  {Object} diff  Browser-generated diff
 * @param  {Object} state Current storage state
 * @return {Array}
 */
export function forEditor(diff, state=getState()) {
    var patches = diff.patches;
    if (!patches || !patches.length) {
		return [];
	}

    var payloads = new Map();
    Object.keys(state.sessions).forEach(tabId => {
        var session = state.sessions[tabId];
        var uri = session.mapping[diff.uri];
        var page = state.pages[session.page];
        if (uri && page && page.direction !== PAGE.DIRECTION_TO_BROWSER) {
            payloads.set(uri, patches);
        }
    });

    return Array.from(payloads.entries()).map(([uri, patches]) => ({uri, patches}));
}

/**
 * Returns array of payloads that should be applied on browser files for given
 * diff
 * @param  {Object} diff  Editor-generated diff
 * @param  {Object} state Current storage state
 * @return {Array}
 */
export function forBrowser(diff, state=getState()) {
    var patches = diff.patches;
    if (!patches || !patches.length) {
		return [];
	}

    return Object.keys(state.sessions).reduce((out, tabId) => {
        var session = state.sessions[tabId];
        var page = state.pages[session.page];
        var uri = keyForValue(session.mapping, diff.uri);
        if (uri && page && page.direction !== PAGE.DIRECTION_TO_EDITOR) {
            out.push({uri, tabId, patches});
        }
        return out;
    }, []);
}
