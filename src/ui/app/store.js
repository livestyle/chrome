'use strict';

import {createStore, applyMiddleware} from 'redux';
import reducers from './reducers';
import createLogger from 'redux-logger';

var initialState = {
    enabled: false,
    model: {},
    ui: {}
};

var enhancer = null;

if (process.env.NODE_ENV !== 'production') {
    initialState.enabled = true;
    initialState.model = {
        direction: 'both',
        browserFiles: [
            'http://localhost:9000/css/main.css',
            'http://localhost:9000/css/module/form.css'
        ],
        editorFiles: [
            '/home/projects/foo/css/main.css',
            '/home/projects/foo/css/assets/form.css',
            '/home/projects/foo/css/assets/inner.css',
            '/home/projects/foo/css/assets/guides.css'
        ],
        mapping: {
            'http://localhost:9000/css/module/form.css': '/home/projects/foo/css/assets/inner.css'
        }
    };
    enhancer = applyMiddleware(createLogger());
}

const store = createStore(reducers, initialState, enhancer);

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
