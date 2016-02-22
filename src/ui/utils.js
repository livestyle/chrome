'use strict';

export function bem(prefix) {
    return function(...classes) {
        var classList = new Set();
        classes.filter(cl => cl || cl === '').forEach(cl => {
            if (!cl) { // empty class name: add prefix
                classList.add(prefix);
            } else if (cl[0] === '-') { // element
                classList.add(prefix + '__' + cl.slice(1));
            } else if (cl[0] === '_') { // modifier
                classList.add(prefix).add(prefix + cl);
            } else {
                classList.add(cl);
            }
        });

        return Array.from(classList).join(' ');
    }
}
