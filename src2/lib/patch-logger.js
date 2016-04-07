/**
 * Formats given patches for better readability and outputs them into console
 */
'use strict';

export default function(patches, options={}) {
    var suffix = Object.keys(options).map(key => `${key}: ${options[key]}`).join(', ');
    console.groupCollapsed('apply patches', suffix ? 'for ' + suffix : '');
	patches.forEach(p => console.log(stringifyPatch(p)));
	console.groupEnd();
};

/**
 * Returns string representation for given node path
 * @param {Array} nodePath
 * @type {String}
 */
export function stringifyPath(nodePath) {
	return nodePath.map(c => c[0] + (c[1] > 1 ? '|' + c[1] : '')).join(' / ');
}

/**
 * Returns string representation of given patch JSON
 * @param {Object} patch
 * @type {String}
 */
export function stringifyPatch(patch) {
	var str = stringifyPath(patch.path) + ' {\n' +
		patch.update.map(prop => `  ${prop.name}: ${prop.value};\n`).join('') +
		patch.remove.map(prop => `  /* ${prop.name}: ${prop.value}; */\n`).join('') +
		'}';

	if (patch.action === 'remove') {
		str = '/* remove: ' + stringifyPath(patch.path) + ' */';
	}

	if (patch.hints && patch.hints.length) {
		var hint = patch.hints[patch.hints.length - 1];
		var self = this;

		var before = (hint.before || []).map(function(p) {
			return stringifyPath([p]);
		}).join(' / ');

		var after = (hint.after || []).map(function(p) {
			return stringifyPath([p]);
		}).join(' / ');

		if (before) {
			str = `/** before: ${before} */\n${str}`;
		}

		if (after) {
			str += `\n/** after: ${after} */\n`;
		}
	}

	return str.trim();
}
