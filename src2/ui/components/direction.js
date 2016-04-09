'use strict';

import tr from 'tiny-react';
import {SESSION} from 'extension-app/lib/action-names';
import {dispatch} from '../app';

const updateDirections = [SESSION.DIRECTION_BOTH, SESSION.DIRECTION_TO_BROWSER, SESSION.DIRECTION_TO_EDITOR];

export default tr.component({
    render(props) {
        return <span className="update-direction" data-direction={props.direction} onclick={cycleUpdateDirection}>
            editor <span className="update-direction__icon" /> browser
        </span>;
    }
});

function cycleUpdateDirection() {
	var dir = this.dataset.direction || updateDirections[0];
	var next = (updateDirections.indexOf(dir) + 1) % updateDirections.length;
    dispatch({
        type: SESSION.UPDATE_DIRECTION,
        direction: updateDirections[next]
    });
}
