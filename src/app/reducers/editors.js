/**
 * Reducers for managing editor connections
 */
'use strict';
import deepequal from 'deep-equal';
import {EDITOR} from '../action-names';

export default function(state={}, action) {
    switch (action.type) {
        case EDITOR.CONNECT:
            state = createEditorEntryIfRequired(state, action.id);
            break;

        case EDITOR.DISCONNECT:
            if (action.id in state) {
                state = {...state};
                delete state[action.id]
            }
            break;

        case EDITOR.UPDATE_FILE_LIST:
            state = createEditorEntryIfRequired(state, action.id);
            if (!deepequal(action.files, state[action.id].files)) {
                state = {
                    ...state,
                    [action.id]: {
                        ...state[action.id],
                        files: action.files
                    }
                };
            }
            break;

        case EDITOR.CLEAR:
            state = {};
            break;
    }

    return state;
}

function createEditorEntryIfRequired(state, editorId) {
    if (!(editorId in state)) {
        state = {
            ...state,
            [editorId]: {files: []}
        };
    }

    return state;
}
