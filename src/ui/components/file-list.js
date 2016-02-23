'use strict';

import tr from 'tiny-react';
import {bem} from '../utils';
import Select from './select';
import compactPaths from '../../lib/compact-paths';
import {dispatch} from '../app/store';
import {UI} from '../app/action-names';
import {PAGE} from '../../app/action-names';

const cl = bem('file-list');

export default tr.component({
    render(props) {
        var browserFiles = compactPaths(props.browserFiles);
        var editorFiles = compactPaths(props.editorFiles);

        return <ul className={cl('')}>
            {browserFiles.map(browserFile => {
                var editorFileProps = {
                    name: browserFile.value,
                    active: props.active === browserFile.value,
                    items: editorFiles.map(file => {
                        return {
                            ...file,
                            selected: props.mapping[browserFile.value] === file.value
                        };
                    }),
                    onActivate: onFilePickerActivate,
                    onPick: onPickFile
                };

                return <li className={cl('-item')} key={browserFile.value}>
    				<div className={cl('-browser')}>{browserFile.label}</div>
    				<div className={cl('-editor')}>
                        <Select {...editorFileProps} />
    				</div>
    			</li>
            })}
		</ul>;
    }
});

function onFilePickerActivate(evt) {
    evt.stopPropagation();
    dispatch({
        type: UI.TOGGLE_ACTIVE_PICKER,
        picker: this.dataset.name
    });
}

function onPickFile() {
    dispatch({
        type: PAGE.UPDATE_FILE_MAPPING,
        editor: this.dataset.value,
        browser: this.closest('.select-box').dataset.name
    });
}
