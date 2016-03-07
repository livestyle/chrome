/**
 * A content script for creating and removing user stylesheets
 */
'use strict';

const urlType = {type: 'text/css'};

export default function sync(items) {
    var current = find().reduce((out, elem) => out.set(elem.dataset.livestyleId, elem), new Map());
    var required = Object.keys(items).reduce((out, key) => out.set(key, items[key]), new Map());

    // remove redundant
    current.forEach((elem, id) => {
        if (!required.has(id)) {
            remove(elem);
        }
    });

    // add missing
    var result = {};
    required.forEach((url, id) => {
        var stylesheet = current.get(id);
        if (!stylesheet) {
            stylesheet = create(id, url);
            document.head.appendChild(stylesheet);
        }

        result[id] = stylesheet.href;
    });

    // result must be a plain object to pass through Chrome messaging system
    return result;
}

export function find() {
	return $$('link[rel="stylesheet"]').filter(link => isUserStylesheet(link));
}

export function isUserStylesheet(node) {
    var dataset = (node && node.dataset) || {};
    return !!dataset.livestyleId;
}

export function createUrl(id) {
	return URL.createObjectURL(new Blob([''], urlType));
}

export function revokeUrl(url) {
    URL.revokeObjectURL(url);
}

function $$(sel, context) {
	return Array.from((context || document).querySelectorAll(sel));
}

/**
 * Creates a new stylesheet with given `content` for given `id`
 * @param  {String} id      Internal user stylesheet id
 * @param  {String} url     Predefined resource URL. If not provided, it will
 *                          be created automatically
 * @return {Element}
 */
function create(id, url) {
	var link = document.createElement('link');
	link.rel = 'stylesheet';
	link.href = url || createUrl(id);
    link.dataset.livestyleId = id;
	return link;
}

/**
 * Removes given user stylesheet
 * @param  {Element} stylesheet
 */
function remove(stylesheet) {
    stylesheet.parentNode.removeChild(stylesheet);
    revokeUrl(stylesheet.href);
}
