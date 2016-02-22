'use strict';

import {createStore} from 'redux';
import reducers from './reducers';

const store = createStore(reducers, {
    model: {},
    ui: {}
});

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
