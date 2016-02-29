'use strict';

import {combineReducers} from 'redux';
import pages from './pages';
import sessions from './sessions';
import editors from './editors';
import editorFiles from './editor-files';
import stateReducer from './state';

const keyReducers = combineReducers({pages, sessions, editors, editorFiles});

export default function(state, action) {
    return stateReducer(keyReducers(state, action), action);
};
