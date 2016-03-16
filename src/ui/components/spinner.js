'use strict';

import tr from 'tiny-react';

export default tr.component({
    render(props) {
        return <span className="spinner">
            <i className="spinner__item"></i>
            <i className="spinner__item"></i>
            <i className="spinner__item"></i>
        </span>;
    }
});
