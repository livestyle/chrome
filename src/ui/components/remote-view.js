'use strict';

import tr from 'tiny-react';
import Toggler from './toggler';
import Spinner from './spinner';
import {bem} from '../utils';
import {dispatch} from '../app/store';
import {UI} from '../app/action-names';
import tween from '../../lib/tween';

const cl = bem('rv');

export default tr.component({
    render(props) {
        var description = this.getDescriptionState(props.ui);
        console.log('description state', description);
        return <div
            className={cl('', description.state === 'expanded' && '_expanded')}
            transition={description.transition}>
    		<header className={cl('-header')}>
                <Toggler name="rv-enabled" checked={!!props} onClick={toggleEnabled} />
                <div className={cl('-title')}>
    				<div className={cl('-message')}>Remote View</div>
    			</div>
    			<div className={cl('-comment')}>
    				<div className={cl('-message')}>Easy way to view local web-sites with LiveStyle updates in other browsers and mobile devices. <span className={cl('-learn-more')} onClick={description.handler}>Learn more</span></div>
    			</div>
    		</header>
    		<section className={cl('-description')}>
    			<p>Remote View creates a publicly available domain name like <em>http://some-name.livestyle.io</em> and connects it with your local domain or IP address (aka “reverse tunnel”). So it looks like anyone browsing the public domain is actually browsing your local web-site from your computer.</p>
    			<p>This way you can easily share your local web-site with colleagues or customers, preview it on any internet-connected mobile device, virtual machine and so on—with instant LiveStyle updates.</p>
    			<p>Requires <a href="http://livestyle.io/" target="_blank">LiveStyle app</a> to be running in background.</p>
    			<p><strong>Remote View is a paid service available for free during beta-testing.</strong></p>
    		</section>
    	</div>
    },

    getDescriptionState(props) {
        var state = props.rvDescription || 'collapsed';
        var handler = state === 'collapsed' ? expandDescription
            : (state === 'expanded' ? collapseDescription : undefined);
        var transition = typeof state === 'function' ? state : undefined;
        return {state, handler, transition};
    }
});

function toggleEnabled() {

}

function expandDescription() {
    console.log('expand description');
    setDescriptionState(expandDescriptionTransition);
}

function collapseDescription() {
    console.log('collapse description');
    setDescriptionState(collapseDescriptionTransition);
}

function setDescriptionState(state) {
    dispatch({type: UI.SET_RV_DESCRIPTION_STATE, state});
}

function expandDescriptionTransition(root) {
	var content = root.querySelector('.rv__description');
	var rect = root.getBoundingClientRect();
    descriptionTransition(root, content, rect.top|0, false,
        () => setDescriptionState('expanded'));
}

function collapseDescriptionTransition(root) {
	var content = root.querySelector('.rv__description');
    descriptionTransition(root, content, content.offsetHeight|0, true, () => {
        setDescriptionState('collapsed');
        root.style.transform = content.style.height = '';
    });
}

function descriptionTransition(root, content, offset, reverse, complete) {
    return tween({
		duration: 400,
		easing: 'outExpo',
        reverse,
        complete,
		step(pos) {
			root.style.transform = `translateY(${-offset * pos}px)`;
			content.style.height = (offset * pos) + 'px';
		}
	});
}
