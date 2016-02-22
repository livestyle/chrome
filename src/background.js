'use strict';
import * as app from './app';
import updateBrowserIcon from './lib/browser-icon';

// update browser icon state when sessions are updated
app.subscribe(updateBrowserIcon, 'sessions');

// broadcast storage update to all subscribers
app.subscribe(state => chrome.runtime.sendMessage({
    action: 'store-update',
    data: state
}));

chrome.runtime.onMessage.addListener(message => {
    if (message && message.action === 'dispatch') {
        dispatch(message.data);
    }
});
