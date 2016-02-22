'use strict';

import {combineReducers} from 'redux';
import pages from './pages';
import sessions from './sessions';
import editorFiles from './editor-files';

export default combineReducers({pages, sessions, editorFiles});
