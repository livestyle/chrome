/**
 * Injecatble content script for extracting page URL’s origin of documents with
 * `file:` protocol.
 * By default, origin for `file:` pages is a filesystem root, so if RV will open
 * a public HTTP server pointing filesystem root, it’s gonna be a huge security
 * breach. This module will try to find a largest common dir prefix for resources
 * from current page.
 *
 * NB: since this script is injectable and has some special semantics, it is used
 * as-is, without any preprocessing
 */
(function() {
    'use strict';
    var elems = Array.from(document.querySelectorAll('link, img, a, video, audio, script, iframe'));

    var m = location.href.match(/^[\w\-]+:\/\//);
    if (!m) {
        return null;
    }
    var proto = m[0];

    return elems.concat([location])
    .map(elem => elem.currentSrc || elem.src || elem.href)
	.filter(url => url && url.startsWith(proto))
	.map(url => {
        // remove protocol from url and normalize it
		var parts = url.slice(proto.length).split(/[\/\\]/);
		if (/\.[\w-]+$/.test(parts[parts.length - 1] || '')) {
			parts.pop();
		}
		return proto + parts.join('/').replace(/\/+$/, '');
	})
	.reduce((prev, cur) => cur.length < prev.length ? cur : prev);
})();
