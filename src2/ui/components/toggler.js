'use strict';

import tr from 'tiny-react';

export default tr.component({
    render(props) {
        return <span className="toggler">
            <input type="checkbox" name={props.name} id={'fld-' + props.name} checked={props.checked} onclick={props.onClick} />
            <span className="toggler__bg">
                <i className="toggler__knob"></i>
            </span>
        </span>;
    }
});
