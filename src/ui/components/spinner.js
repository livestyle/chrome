'use strict';

import tr from 'tiny-react';

export default tr.component({
    render(props) {
        return <span className="spinner">
            <i classname="spinner__item"></i>
            <i classname="spinner__item"></i>
            <i classname="spinner__item"></i>
        </span>;
    }
});
