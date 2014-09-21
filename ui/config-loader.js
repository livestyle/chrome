var require = {};
(function() {
	var pathPrefix = null, configPath = null;
	var scripts = document.getElementsByTagName('script');
	for (var i = 0, il = scripts.length; i < il; i++) {
		if (~scripts[i].src.indexOf('config-loader.js')) {
			configPath = scripts[i].getAttribute('data-config-path');
			pathPrefix = scripts[i].getAttribute('data-path-prefix');
			break;
		}
	}

	var xhr = new XMLHttpRequest();
	xhr.open('GET', configPath, false);
	xhr.send();
	require = JSON.parse(xhr.responseText);

	if (pathPrefix) {
		Object.keys(require.paths).forEach(function(key) {
			require.paths[key] = pathPrefix + require.paths[key];
		});
	}
})();
console.log('rjs config', require);