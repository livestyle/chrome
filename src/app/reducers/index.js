'use strict';

import {combineReducers} from 'redux';
import pages from './pages';
import sessions from './sessions';
import editors from './editors';
import editorFiles from './editor-files';

export default combineReducers({pages, sessions, editors, editorFiles});
