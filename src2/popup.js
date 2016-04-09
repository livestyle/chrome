/**
 * Main popup controller
 */
'use strict';

import tr from 'tiny-react';
import Popup from './ui/components/popup';
import {getState, subscribe, dispatch} from './ui/app';
import {UI} from './ui/app/action-names';

var transitions = new Map();

const popup = tr.render(Popup, getState(), {
	rendered(tree, target) {
		// when tree is rendered, find all inner nodes with transitions and
		// run them in context of rendered node
		var newTransitions = findNodesWithTransition(target);
		newTransitions.forEach((transition, node) => {
			if (transitions.get(node) !== transition) {
				// newly added transition, run it in context of rendered node
				transition(node);
			}
		});
		transitions = newTransitions;
	}
});

document.body.appendChild(popup.target);
document.addEventListener('click', evt => dispatch({type: UI.RESET_ACTIVE_PICKER}));
subscribe(update);

function update(state=getState()) {
	popup.update(state);

}

function findNodesWithTransition(tree) {
	var result = new Map();
	if (hasTransition(tree)) {
		result.set(tree, tree.transition);
	}

	var elems = tree.getElementsByTagName('*');
	for (let i = 0, il = elems.length; i < il; i++) {
		if (hasTransition(elems[i])) {
			result.set(elems[i], elems[i].transition);
		}
	}

	return result;
}

function hasTransition(node) {
	return typeof node.transition === 'function';
}
