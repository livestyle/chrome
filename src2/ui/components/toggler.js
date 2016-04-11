'use strict';

import tr from 'tiny-react';

export default tr.component({
    render(props) {
        return <span className="toggler">
            <input type="checkbox"
                id={'fld-' + props.name}
                name={props.name}
                value={props.value || ''}
                checked={props.checked}
                onclick={props.onClick} />
            <span className="toggler__bg">
                <i className="toggler__knob"></i>
            </span>
        </span>;
    }
});
