'use strict';
import * as app from './app';
import updateBrowserIcon from './lib/browser-icon';
import updatePopups from './app/popup-controller';


// update browser icon state when sessions are updated
app.subscribe(updateBrowserIcon, 'sessions');

// broadcast storage update to all connected popups
app.subscribe(updatePopups);
