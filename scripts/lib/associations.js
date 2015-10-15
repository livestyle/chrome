/**
 * Returns virtual associations between browser and editor files.
 *
 * Unlike “real” associations where user manually picks files,
 * virtual associations may contain guessed matches that
 * may change if user opens another file in editor
 */
'use strict';

export default function(browserFiles, editorFiles, assocs) {
	assocs = assocs || {};
	browserFiles = browserFiles || [];
	editorFiles = editorFiles || [];

	return browserFiles.reduce(function(result, browserFile) {
		var editorFile = assocs[browserFile];
		if (editorFile == null) {
			// user didn’t picked association yet: guess it
			// XXX compare with `null` and `undefined` because empty string
			// means user forcibly removed association (for example, from 
			// guessed association)
			editorFile = ~editorFiles.indexOf(browserFile) ? browserFile : guessAssoc(editorFiles, browserFile);
		} else if (!~editorFiles.indexOf(editorFile)) {
			// we have association but user didn’t opened it yet:
			// assume there’s no association
			editorFile = null;
		}
		result[browserFile] = editorFile;
		return result;
	}, {});
}

function pathLookup(path) {
	return path.split('/').filter(Boolean);
}

function guessAssoc(list, file) {
	var fileLookup = pathLookup(file).reverse();
	var candidates = list.map(function(path) {
		return {
			path: path,
			lookup: pathLookup(path)
		};
	});

	var chunk, prevCandidates;
	for (var i = 0, il = fileLookup.length; i < il; i++) {
		prevCandidates = candidates;
		candidates = candidates.filter(function(candidate) {
			return fileLookup[i] == candidate.lookup.pop();
		});

		if (candidates.length === 1) {
			break;
		} else if (!candidates.length) {
			// empty candidates list on first pass means we
			// didn’t found anything at all
			candidates = i ? prevCandidates : null;
			break;
		}
	}

	if (candidates && candidates.length) {
		return candidates[0].path;
	}
}