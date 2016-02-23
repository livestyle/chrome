/**
 * Main popup controller
 */
'use strict';

import tr from 'tiny-react';
import Popup from './ui/components/popup';
import {getState, subscribe, dispatch} from './ui/app/store';
import {UI} from './ui/app/action-names';

const popup = tr.render(Popup, getState());

document.body.appendChild(popup.target);
document.addEventListener('click', evt => dispatch({type: UI.RESET_ACTIVE_PICKER}));
subscribe(update);

function update(state=getState()) {
	popup.update(state);
}
