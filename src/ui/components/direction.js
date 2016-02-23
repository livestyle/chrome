'use strict';

import tr from 'tiny-react';
import {PAGE} from '../../app/action-names';
import {dispatch} from '../app/store';

const updateDirections = [PAGE.DIRECTION_BOTH, PAGE.DIRECTION_TO_BROWSER, PAGE.DIRECTION_TO_EDITOR];

export default tr.component({
    render(props) {
        return <span className="update-direction" data-direction={props.direction} onclick={cycleUpdateDirection}>
            editor <span className="update-direction__icon" /> browser
        </span>;
    }
});

function cycleUpdateDirection() {
	var dir = this.dataset.direction || updateDirections[0];
    console.log('cur direction', dir);
	var next = (updateDirections.indexOf(dir) + 1) % updateDirections.length;
    console.log('next direction', next, updateDirections[next]);
    dispatch({
        type: PAGE.UPDATE_DIRECTION,
        direction: updateDirections[next]
    });
}
