/**
 * Compacts given list of paths: keeps smallest right-hand 
 * difference between paths
 */
if (typeof module === 'object' && typeof define !== 'function') {
	var define = function (factory) {
		module.exports = factory(require, exports, module);
	};
}

define(function(require, exports, module) {
	function compact(item) {
		return !!item;
	}

	function unique(list) {
		var lookup = [];
		return list.filter(function(item) {
			var exists = lookup.indexOf(item) !== -1;
			if (!exists) {
				lookup.push(item);
			}

			return !exists;
		});
	}

	return function(list) {
		var data = unique(list).map(function(path) {
			return {
				parts: path.split(/\/|\\/).filter(compact),
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
});