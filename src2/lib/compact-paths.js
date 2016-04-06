/**
 * Compacts given list of paths: keeps smallest right-hand
 * difference between paths
 */
'use strict';

import {unique} from './utils';

export default function(list) {
	var data = unique(list).map(function(path) {
		return {
			parts: path.split(/\/|\\/).filter(Boolean),
			rightParts: [],
			path: path
		};
	});

	var lookup = {};
	var hasCollision = true, hasNext = true;
	var process = function(item) {
		if (item.parts.length) {
			item.rightParts.unshift(item.parts.pop());
			var lookupKey = item.rightParts.join('/');
			if (!lookup[lookupKey]) {
				lookup[lookupKey] = true;
			} else {
				hasCollision = true;
			}
		}
		return !!item.parts.length;
	};

	while (hasNext) {
		hasNext = false;
		hasCollision = false;
		lookup = {};
		for (var i = 0, il = data.length; i < il; i++) {
			hasNext = process(data[i]) || hasNext;
		}

		if (!hasCollision) {
			break;
		}
	}

	return data.map(function(item) {
		return {
			label: item.parts.length ? item.rightParts.join('/') : item.path,
			value: item.path
		};
	});
};
