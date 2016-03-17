'use strict';

import tr from 'tiny-react';
import Toggler from './toggler';
import Spinner from './spinner';
import {bem, $, $$} from '../utils';
import {dispatch, getStateValue} from '../app/store';
import {UI} from '../app/action-names';
import {REMOTE_VIEW} from '../../app/action-names';
import tween from '../../lib/tween';

const cl = bem('rv');
const messages = {
    'default': message(
        'Remote View',
        <span>Easy way to view local web-sites with LiveStyle updates in other browsers and mobile devices. <span className={cl('-learn-more')} onClick={toggleDescription}>Learn more</span></span>
    ),
	'unavailable': message(
		'Remote View is not available',
        <span>Remote View only works for web-sites with HTTP, HTTPS and FILE protocols. <span className={cl('-learn-more')} onClick={toggleDescription}>Learn more</span></span>
	),
	'no-origin': message(
		'Remote View is not available',
        <span>Unable to get URL origin for current page. Please <a href="http://github.com/livestyle/issues/issues" target="_blank">report this issue</a> with URL of your page.</span>
	),
	'connecting': message(<span>Connecting <Spinner /></span>),
	'no-app': message(
        'No LiveStyle App',
        <span>Make sure <a href="http://livestyle.io/" target="_blank">LiveStyle app</a> is running.</span>
    )
};

export default tr.component({
    render(props) {
        var session = props.session || {};
        var ui = props.ui || {};
        var msg = getRecentMessages(props);
        var stateToggler;
        if (session.state === REMOTE_VIEW.STATE_CONNECTED) {
            stateToggler = disable;
        } else if (session.state !== REMOTE_VIEW.STATE_PENDING) {
            stateToggler = enable;
        }

        return <div
            className={cl('', `_${ui.descriptionState || 'collapsed'}`)}
            transition={ui.transition}>
    		<header className={cl('-header')}>
                <Toggler name="rv-enabled" checked={session.state && session.state !== REMOTE_VIEW.STATE_PENDING} onClick={stateToggler} />
                <div className={cl('-title')}>
                    {outputMessage(msg.primary.title)}
                    {msg.secondary && msg.secondary.title ? outputMessage(msg.secondary.title, 'secondary') : undefined}
    			</div>
    			<div className={cl('-comment')}>
                    {outputMessage(msg.primary.comment || messages.default.comment)}
                    {msg.secondary && msg.secondary.comment ? outputMessage(msg.secondary.comment, 'secondary') : undefined}
    			</div>
    		</header>
    		<section className={cl('-description')}>
    			<p>Remote View creates a publicly available domain name like <em>http://some-name.livestyle.io</em> and connects it with your local domain or IP address (aka “reverse tunnel”). So it looks like anyone browsing the public domain is actually browsing your local web-site from your computer.</p>
    			<p>This way you can easily share your local web-site with colleagues or customers, preview it on any internet-connected mobile device, virtual machine and so on—with instant LiveStyle updates.</p>
    			<p>Requires <a href="http://livestyle.io/" target="_blank">LiveStyle app</a> to be running in background.</p>
    			<p><strong>Remote View is a paid service available for free during beta-testing.</strong></p>
    		</section>
    	</div>
    }
});

function message(title, comment=null) {
	return {title, comment};
}

function enable() {
    dispatch({type: REMOTE_VIEW.CREATE_SESSION});
}

function disable() {
    dispatch({type: REMOTE_VIEW.REMOVE_SESSION});
}

function getRecentMessages(props) {
    return {
        primary: getMessage(props.ui.messages[0] || 'default'),
        secondary: getMessage(props.ui.messages[1])
    };
}

function getMessage(name) {
    if (typeof name === 'string') {
        return messages[name];
    }

    name = name || {};
    if (name.name && name.name in messages) {
        return messages[name.name];
    }

    if (name.name === 'error') {
        return message(name.code, name.message);
    }

    if ('title' in name || 'comment' in name) {
        return name;
    }
}

function outputMessage(content, key='primary') {
    return <div key={key} className={cl('-message', '-message_' + key)}>{content}</div>
}

function toggleDescription() {
    var props = getStateValue('ui.remoteView');
    if (props.transition) {
        return undefined;
    }

    setTransition(props.descriptionState === 'expanded'
        ? collapseDescriptionTransition
        : expandDescriptionTransition);
}

function setTransition(transition) {
    dispatch({type: UI.RV_SET_TRANSITION, transition});
}

function setDescriptionState(state) {
    dispatch({type: UI.RV_SET_DESCRIPTION_STATE, state});
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

function messageTransition(root) {
    Promise.all([
        swapMessage($('.rv__title', root)),
        swapMessage($('.rv__comment', root))
    ].filter(Boolean))
    .then(() => dispatch({
        type: UI.RV_SHIFT_MESSAGE,
        transition: messageTransitionComplete
    }));
}

function messageTransitionComplete(root) {
    resetMessageAfterSwap($('.rv__title', root));
    resetMessageAfterSwap($('.rv__comment', root));
    if (getStateValue('ui.remoteView.messages').length > 1) {
        setTransition(messageTransition);
    }
}

function swapMessage(container) {
    // measure sizes and positions for previous message
    var msg = $$('.rv__message', container);
    if (msg.length === 1) {
        // only one message, no transition
        return;
    }

	var [pm, sm] = msg;
    sm.style.display = 'block';
	var pcRect = pm.getBoundingClientRect();
	var ncRect = sm.getBoundingClientRect();

	// get ready for animation
	var dh = ncRect.height - pcRect.height;
	container.style.height = pcRect.height + 'px';

    return new Promise(complete => {
        tween({
    		easing: 'outExpo',
    		duration: 300,
            complete,
    		step(pos) {
    			pm.style.transform = sm.style.transform = `translateY(${-pos * pcRect.height}px)`;
    			if (dh) {
    				container.style.height = (pcRect.height + pos * dh) + 'px';
    			}
    		}
    	});
    });
}

function resetMessageAfterSwap(container) {
    var msg = $$('.rv__message', container);
    msg.forEach(m => m.style.transform = m.style.display = '');
    container.style.height = '';
}
