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
const transitions = {
    [UI.T_EXPAND_DESCRITION]: expandDescriptionTransition,
    [UI.T_COLLAPSE_DESCRITION]: collapseDescriptionTransition,
    [UI.T_SWAP_MESSAGE]: swapMessageTransition,
    [UI.T_SWAP_MESSAGE_COMPLETE]: swapMessageTransitionComplete
};

const messages = {
    'default': message(
        'Remote View',
        <span>Easy way to view local web-sites with LiveStyle updates in other browsers and mobile devices. <span className={cl('-learn-more')} onclick={toggleDescription}>Learn more</span></span>
    ),
	'unavailable': message(
		'Remote View is not available',
        <span>Remote View only works for web-sites with HTTP, HTTPS and FILE protocols. <span className={cl('-learn-more')} onclick={toggleDescription}>Learn more</span></span>
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
        var stateToggler = noopHandler;
        if (session.state === REMOTE_VIEW.STATE_CONNECTED) {
            stateToggler = disable;
        } else if (session.state !== REMOTE_VIEW.STATE_PENDING) {
            stateToggler = enable;
        }

        return <div
            className={cl('', `_${ui.descriptionState || 'collapsed'}`)}
            transition={getTransition(props)}>
    		<header className={cl('-header')}>
                <Toggler name="rv-enabled" checked={session.state === REMOTE_VIEW.STATE_CONNECTED} onClick={stateToggler} />
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

function toggleDescription() {
    var props = getStateValue('ui.remoteView');
    dispatch({type: props.descriptionState === 'expanded'
        ? UI.RV_COLLAPSE_DESCRIPTION
        : UI.RV_EXPAND_DESCRIPTION});
}

function enable(evt) {
    evt.preventDefault();
    dispatch({type: REMOTE_VIEW.CREATE_SESSION});
}

function disable(evt) {
    evt.preventDefault();
    dispatch({type: REMOTE_VIEW.REMOVE_SESSION});
}

function noopHandler(evt) {
    evt.preventDefault();
}

function getRecentMessages(props) {
    var messages = props.ui.messages;
    return {
        primary: getMessage(messages[0] || 'default'),
        secondary: getMessage(messages[1])
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

function getTransition(props) {
    return transitions[props.ui.transition];
}

function outputMessage(content, key='primary') {
    return <div key={key} className={cl('-message', '-message_' + key)}>{content}</div>
}

function expandDescriptionTransition(root) {
	var content = root.querySelector('.rv__description');
	var rect = root.getBoundingClientRect();
    descriptionTransition(root, content, rect.top|0, false, descriptionTransitionComplete);
}

function collapseDescriptionTransition(root) {
	var content = root.querySelector('.rv__description');
    descriptionTransition(root, content, content.offsetHeight|0, true, () => {
        root.style.transform = content.style.height = '';
        descriptionTransitionComplete();
    });
}

function descriptionTransitionComplete() {
    dispatch({type: UI.RV_DESCRIPTION_TRANSITION_COMPLETE});
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

function swapMessageTransition(root) {
    Promise.all([
        swapMessage($('.rv__title', root)),
        swapMessage($('.rv__comment', root))
    ].filter(Boolean))
    .then(() => dispatch({type: UI.RV_SHIFT_MESSAGE}));
}

function swapMessageTransitionComplete(root) {
    resetMessageAfterSwap($('.rv__title', root));
    resetMessageAfterSwap($('.rv__comment', root));
    dispatch({type: UI.RV_SWAP_MESSAGE_COMPLETE});
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
    		duration: 400,
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
