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
            name: props.userStylesheets[url],
            userId: props.userStylesheets[url]
        }));

        return <ul className={cl('')}>
            {browserFiles.map(file => outputFileItem(file, editorFiles, props.active, props.mapping))}
            {userFiles.map(file => outputFileItem(file, editorFiles, props.active, props.mapping))}
		</ul>;
    }
});

function outputFileItem(browserFile, editorFiles, activeFile, mapping) {
    var name = browserFile.name || browserFile.value;
    var editorFileProps = {
        name,
        active: activeFile === name,
        items: editorFiles.map(file => {
            return {
                ...file,
                selected: mapping[browserFile.value] === file.value
            };
        }),
        onActivate: onFilePickerActivate,
        onPick: onPickFile
    };

    return <li className={cl('-item', browserFile.userId && '-item_user')} key={browserFile.value}>
        <div className={cl('-browser')}>
            {browserFile.label}
            {browserFile.userId ? <i className={cl('-item-remove')} onclick={removeUserStylesheet} data-user-id={browserFile.value}></i> : undefined}
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

function onPickFile() {
    dispatch({
        type: SESSION.UPDATE_FILE_MAPPING,
        editor: this.dataset.value,
        browser: this.closest('.select-box').dataset.name
    });
}

function removeUserStylesheet() {
    dispatch({
        type: SESSION.REMOVE_USER_STYLESHEET,
        id: this.dataset.userId
    });
}
