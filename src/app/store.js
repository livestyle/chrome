'use strict';

import {createStore, applyMiddleware} from 'redux';
import createLogger from 'redux-logger';
import thunk from 'redux-thunk';
import reducers from './reducers';

var middlewares = [thunk];
if (process.env.NODE_ENV !== 'production') {
    middlewares.push(createLogger());
}

// @see store-example.js with model reference
const store = createStore(reducers, {
    editorFiles: [],
    pages: {},
    sessions: {}
}, applyMiddleware(...middlewares));

export function dispatch(data) {
    return store.dispatch(data);
}

export function subscribe(onChange, select) {
    let currentState;
    let handler = () => {
        let nextState = getState();
        if (typeof select === 'function') {
            nextState = select(nextState);
        } else if (typeof select === 'string') {
            // watching for a specific key in store
            nextState = getStateValue(select, nextState);
        }
        if (nextState !== currentState) {
            currentState = nextState;
            onChange(currentState);
        }
    };

    return store.subscribe(handler);
}

export function subscribeDeepKey(rootKey, innerKey, onChange) {
    if (typeof innerKey === 'function') {
        [onChange, innerKey] = [innerKey, null];
    }
    let currentState = {};
    let handler = () => {
        let nextState = getStateValue(rootKey);
        // find out which object were updated and invoke `onChange` handler for each
        if (currentState !== nextState) {
            Object.keys(nextState).forEach(key => {
                let cur = currentState[key];
                let next = nextState[key];
                if (!cur || cur !== next) {
                    if (innerKey) {
                        // invoke handler only if specified key was updated
                        let prevValue = cur ? cur[innerKey] : undefined;
                        let nextValue = next ? next[innerKey] : undefined;
                        currentState = nextState;
                        if (prevValue !== nextValue) {
                            onChange(next, key, nextValue, prevValue, innerKey);
                        }
                    } else {
                        currentState = nextState;
                        onChange(next, key);
                    }
                }
            });
        }
    };

    return store.subscribe(handler);
}

export function getState() {
    return store.getState();
}

export function getStateValue(key, state=getState()) {
    var ctx = state;
    var parts = key.split('.');
    while (parts.length) {
        let key = parts.shift();
        if (key in ctx) {
            ctx = ctx[key];
        } else {
            return undefined;
        }
    }

    return ctx;
}
