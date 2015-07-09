'use strict';

function padNum(num) {
	return (num < 10 ? '0' : '') + num;
}

function toDOM(html) {
	var div = document.createElement('div');
	div.innerHTML = html;
	var df = document.createDocumentFragment();
	while (div.firstChild) {
		df.appendChild(div.firstChild);
	}
	return df;
}

function renderLogItem(item) {
	var date = new Date(item.date);
	var time = padNum(date.getHours()) + ':' + padNum(date.getMinutes());

	return toDOM('<li id="' + item.messageId + '" class="log__item" data-type="' + item.type + '">' 
		+ '<span class="time">[' + time + ']</span> '
		+ item.message.replace(/\t/g, ' ')
		+ '</li>'
		);
}

function updateLog(items) {
	// show log items in reverse order, e.g. newer on top
	items = items.reverse();

	var container = document.querySelector('.log');
	var currentItems = container.querySelectorAll('.log__item');
	var lookup = {};
	for (var i = 0, il = currentItems.length; i < il; i++) {
		lookup[currentItems[i].getAttribute('id')] = currentItems[i];
	}

	var df = document.createDocumentFragment();
	items.forEach(function(item) {
		var itemId = item.messageId + '';
		if (lookup[itemId]) {
			df.appendChild(lookup[itemId]);
			delete lookup[itemId];
		} else {
			df.appendChild(renderLogItem(item));
		}
	});

	// Remove old messages
	Object.keys(lookup).forEach(function(id) {
		container.removeChild(lookup[id]);
	});

	// Insert current messages
	container.appendChild(df);
}

// Listen to log updates
chrome.runtime.onMessage.addListener(function(message) {
	if (message.name === 'log-updated') {
		updateLog(message.data);
	}
});

// Request current log
chrome.runtime.sendMessage({name: 'get-log'}, updateLog);