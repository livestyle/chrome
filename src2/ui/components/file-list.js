'use strict';

import tr from 'tiny-react';
import {SESSION} from 'extension-app/lib/action-names';
import {bem} from '../utils';
import Select from './select';
import compactPaths from '../../lib/compact-paths';
import {dispatch} from '../app';
import {UI} from '../app/action-names';

const cl = bem('file-list');
const EMPTY_OBJECT = {};

export default tr.component({
    render(props) {
        // sort browser files by name and user files
        var browserFiles = compactPaths(props.browserFiles.filter(file => !props.userStylesheets[file]));
        var editorFiles = compactPaths(props.editorFiles);
        var userFiles = Object.keys(props.userStylesheets).map((url, i) => ({
            label: 'user stylesheet ' + (i + 1),
            value: url,
            isUser: true
        }));

        return <ul className={cl('')} data-session-id={props.sessionId}>
            {browserFiles.map(file => outputFileItem(file, editorFiles, props))}
            {userFiles.map(file => outputFileItem(file, editorFiles, props))}
		</ul>;
    }
});

function outputFileItem(browserFile, editorFiles, props) {
    var name = browserFile.name || browserFile.value;
    var editorFileProps = {
        name,
        active: props.active === name,
        items: editorFiles.map(file => {
            return {
                ...file,
                selected: props.mapping[browserFile.value] === file.value
            };
        }),
        onActivate: onFilePickerActivate,
        onPick: onPickFile
    };

    return <li className={cl('-item', browserFile.isUser && '-item_user')} key={browserFile.value}>
        <div className={cl('-browser')}>
            {browserFile.label}
            {browserFile.isUser ? <i className={cl('-item-remove')} onclick={removeUserStylesheet} data-stylesheet={browserFile.value}></i> : undefined}
        </div>
        <div className={cl('-editor')}>
            <Select {...editorFileProps} />
        </div>
    </li>;
}

function onFilePickerActivate(evt) {
    evt.stopPropagation();
    dispatch({
        type: UI.TOGGLE_ACTIVE_PICKER,
        picker: this.dataset.name
    });
}

function onPickFile(evt) {
    dispatch({
        type: SESSION.UPDATE_FILE_MAPPING,
        id: getSessionId(evt.target),
        editor: this.dataset.value,
        browser: this.closest('.select-box').dataset.name
    });
}

function removeUserStylesheet(evt) {
    dispatch({
        type: SESSION.REMOVE_USER_STYLESHEET,
        id: getSessionId(evt.target),
        stylesheet: this.dataset.stylesheet
    });
}

function getSessionId(ctx) {
    while (ctx && ctx !== document) {
        if (ctx.dataset.sessionId) {
            return ctx.dataset.sessionId;
        }
        ctx = ctx.parentNode;
    }
}
