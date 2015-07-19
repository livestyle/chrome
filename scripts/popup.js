/**
 * Main popup controller
 */
'use strict';

import compactPaths from './helpers/compact-paths';
import * as selectBox from './ui/select-box';
import {$, $$, copy, closest, toDom} from './lib/utils';
import setupRemoteView from './ui/remote-view';

var updateDirections = ['both', 'to browser', 'to editor'];
var currentModel = null;

function sendMessage(name, data) {
	chrome.runtime.sendMessage({
		name: name,
		data: data
	});
}

function populateSelect(name, options, selected) {
	var opt = options.map((option, i) => {
		var selectedAttr = (selected === i || selected === option.value) 
			? ' selected="selected"' 
			: '';
		return `<option value="${option.value}"${selectedAttr}>${option.label}</option>`;
	});

	return `<select name="${name}" id="fld-${name}">
		<option value="">…</option>
		${opt.join('')}
		</select>`;
}

function renderFileItem(label, value, editorFilesView, isUserFile) {
	var parts = label.split('?');
	label = parts.shift();
	if (isUserFile) {
		label += '<i class="file__remove"></i>';
	}
	if (parts.length) {
		label += `<span class="file__browser-addon">${parts.join('?')}</span>`;
	}

	return `<li class="file-list__item${(isUserFile ? ' file-list__item_user' : '')}">
		<div class="file__browser" data-full-path="${value}">${label}</div>
		<div class="file__editor">${editorFilesView}</div>
		</li>`;
}

function renderFileList() {
	var browserFiles = compactPaths(currentModel.get('browserFiles') || []);
	var editorFiles = compactPaths(currentModel.get('editorFiles') || []);
	var userStylesheets = currentModel.get('userStylesheets') || {};
	var assocs = currentModel.associations();
	
	var html = '<ul class="file-list">'
		+ browserFiles.map( file => renderFileItem(file.label, file.value, populateSelect(file.value, editorFiles, assocs[file.value])) ).join('')
		+ Object.keys(userStylesheets).map( (userId, i) => renderFileItem('user stylesheet ' + (i + 1), userId, populateSelect(userId, editorFiles, assocs[userId]), true) ).join('')
		+ '</ul>';

	var fileList = toDom(html);
	var prevFileList = $('.file-list');
	var parent = prevFileList.parentNode;
	parent.insertBefore(fileList, prevFileList);
	parent.removeChild(prevFileList);
	selectBox.init(fileList);
	$$('select', fileList).forEach(select => {
		select.addEventListener('change', function() {
			var assocs = copy(currentModel.get('assocs'));
			assocs[select.name] = select.value;
			currentModel.set('assocs', assocs);
		}, false);
	});

	return fileList;
}

function renderUpdateDirection() {
	var dir = currentModel.get('updateDirection') || updateDirections[0];
	$('.update-direction').dataset.direction = dir;
}

function cycleUpdateDirection() {
	var elem = $('.update-direction');
	var dir = elem.dataset.direction || updateDirections[0];
	var next = (updateDirections.indexOf(dir) + 1) % updateDirections.length;
	currentModel.set('updateDirection', updateDirections[next]);
}

function toggleEnabledState() {
	currentModel.set('enabled', $('#fld-enabled').checked);
}

function renderEnabledState() {
	$('#fld-enabled').checked = !!currentModel.get('enabled');
}

/**
 * Displays temporary message about errors happened
 * in LiveStyle patcher
 * @param  {Boolean} hasError 
 */
function toggleErrorStateMessage(hasError) {
	$('.error-message').classList.toggle('hidden', !hasError);
}

/**
 * Displays permanent link on error log
 */
function showErrorLogLink() {
	$('.error-log-link').classList.remove('hidden');
}

function setup() {
	$('#fld-enabled').addEventListener('change', toggleEnabledState);
	$('.update-direction').addEventListener('click', cycleUpdateDirection);
	$('.add-file').addEventListener('click', function(evt) {
		evt.stopPropagation();
		sendMessage('add-user-stylesheet');
	});

	document.addEventListener('click', function(evt) {
		if (evt.target.classList.contains('file__remove')) {
			evt.stopPropagation();
			var browserFile = closest(evt.target, '.file__browser');
			sendMessage('remove-user-stylesheet', {url: browserFile.dataset.fullPath});
		}
	});
}

function setupModel(model) {
	currentModel = model;
	renderEnabledState();
	renderFileList();
	renderUpdateDirection();
	model
	.on('update', renderFileList)
	.on('change:enabled', renderEnabledState)
	.on('change:updateDirection', renderUpdateDirection);
}

function resetModel() {
	currentModel
	.off('update', renderFileList)
	.off('change:enabled', renderEnabledState)
	.off('change:updateDirection', renderUpdateDirection);
	currentModel = null;
}

chrome.runtime.onMessage.addListener(function(message) {
	if (message && message.name === 'log-updated') {
		showErrorLogLink();
	}
});

// bind model with view
chrome.runtime.getBackgroundPage(function(bg) {
	var LiveStyle = bg.LiveStyle;

	function updateActivityState() {
		$('.popup').classList.toggle('status__no-editor', !LiveStyle.isActive());
	}

	// keep track of errors
	LiveStyle.errorStateTracker.on('change:error', toggleErrorStateMessage);
	toggleErrorStateMessage(LiveStyle.errorStateTracker.get('error'));

	if (LiveStyle.hasErrors()) {
		showErrorLogLink();
	}

	updateActivityState();
	setup();
	LiveStyle.updateIconState();
	LiveStyle.editorController.on('change:active', updateActivityState);
	LiveStyle.getCurrentModel(function(model, tab) {
		setupModel(model);
		setupRemoteView(model, $('.rv'));

		if (/^file:/.test(tab.url)) {
			$('.popup').classList.toggle('status__file-protocol', !LiveStyle.hasOpenedDevTools(tab.id));
		}

		window.addEventListener('unload', function() {
			resetModel();
			LiveStyle.editorController.off('change:active', updateActivityState);
			LiveStyle.errorStateTracker.off('change:error', toggleErrorStateMessage);
		}, false);
	});
});