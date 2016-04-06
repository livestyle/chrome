/**
 * A select box component
 */
import tr from 'tiny-react';
import {bem} from '../utils';

const emptyItem = {label: '...', value: null};
const cl = bem('select-box');

export default tr.component({
    render(props) {
        var items = props.items || [];
        var selected = items.filter(item => item.selected)[0] || emptyItem;
        return <div className={cl('', props.active && '_active')} data-name={props.name} onclick={props.onActivate}>
            <span className={cl('-label')}>{selected.label}</span>
            <ul className={cl('-picker')}>
                {items.map(item => {
                    return <li
                        className={cl('-picker-item', item.selected && '-picker-item_selected')}
                        data-value={item.value}
                        onclick={props.onPick}>
                            {item.label}
                        </li>;
                })}
            </ul>
        </div>;
    }
});
