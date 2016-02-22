'use strict';

import tr from 'tiny-react';

export default tr.component({
    render(props) {
        return <span class="toggler">
            <input type="checkbox" name={props.name} id={'fld-' + props.name} checked={props.checked} onclick={props.onClick} />
            <span class="toggler__bg">
                <i class="toggler__knob"></i>
            </span>
        </span>;
    }
});
