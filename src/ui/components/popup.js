'use strict';

import tr from 'tiny-react';
import Toggler from './toggler';
import Direction from './direction';
import FileList from './file-list';
import RemoteView from './remote-view';
import {PAGE} from '../../app/action-names';
import {dispatch} from '../app/store';

export default tr.component({
    render(props) {
        var content;
        var isEnabled = !!props.model.enabled;
        if (isEnabled) {
            content = <div className="popup__content">
                <FileList {...props.model} active={props.ui.activePicker} />
                <button className="add-file" onclick={addUserStylesheet}>Add stylesheet</button>
            </div>;
        }

        return <div className="layout">
            <div className="popup">
                <fieldset className="activity">
                    <Toggler name="enabled" checked={isEnabled} onClick={toggleEnabled} />
                    <label htmlFor="fld-enabled">Enable LiveStyle</label>
                    <em>for current page with
                        <Direction direction={props.model.direction} />
                    updates</em>
                </fieldset>
                {content}
            </div>
            <RemoteView session={props.model.remoteView} ui={props.ui.remoteView}
                url={props.model.url} origin={props.model.origin} />
        </div>;
    }
});

function toggleEnabled(evt) {
    evt.preventDefault();
    dispatch({type: PAGE.TOGGLE_ENABLED});
}

function addUserStylesheet(evt) {
    evt.preventDefault();
    dispatch({type: PAGE.ADD_USER_STYLESHEET});
}
