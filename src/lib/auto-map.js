/**
 * Returns automatic mappings of browser-to-editor files, based on file name
 */
'use strict';

export default function(browserFiles=[], editorFiles=[]) {
    return browserFiles.reduce((out, file) => {
        out[file] = autoMap(file, editorFiles);
        return out;
    });
};

function autoMap(file, list) {
	let fileLookup = pathLookup(file);
    let compare = candidate => {
        let part = candidate.lookup.pop();
        let curPart = fileLookup[fileLookup.length - 1];
        return curPart === part || cleanFileName(curPart) === cleanFileName(part);
    };
    let candidates = list.map(path => ({path, lookup: pathLookup(path)})).filter(compare);

    // if there’s no candidates after initial check (e.g. there’s no files with
    // the same name) — abort, no need to search further
    if (!candidates.length) {
        return;
    }

    // narrow down candidates list
    fileLookup.pop();
    while (fileLookup.length && candidates.length > 1) {
        let nextCandidates = candidates.filter(compare);
        if (!nextCandidates.length) {
            break;
        }
        candidates = nextCandidates;
        fileLookup.pop();
    }

    return candidates[0].path;
}

function pathLookup(path) {
	return path.split('?')[0].split('/').filter(Boolean);
}

function cleanFileName(file) {
	return file.replace(/\.\w+$/, '');
}
