'use strict';

import {combineReducers} from 'redux';
import pages from './pages';
import sessions from './sessions';
import editors from './editors';
import editorFiles from './editor-files';
import remoteView from './remote-view';
import stateReducer from './state';
import mappingReducer from './mapping';

const keyReducers = combineReducers({pages, sessions, editors, editorFiles, remoteView});

export default function(state={}, action) {
    var prev = state;
    var next = stateReducer(keyReducers(state, action), action);
    return mappingReducer(prev, next);
};
