/**
 * Entire storage state reducer
 */
'use strict';
import deepmerge from 'deepmerge';
import {STATE} from '../action-names';

export default function(state={}, action) {
    if (action.type === STATE.LOAD) {
        state = deepmerge(state, action.state);
    }
    return state;
};
