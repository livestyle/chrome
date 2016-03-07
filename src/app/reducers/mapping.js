/**
 * Updates session browser-to-editor file mappings.
 * This mapping depends on these factors/state properties:
 * – editorFiles
 * — pages.userMapping
 * — sessions.stylesheets
 * If any of these properties changes, we should re-calculate session mapping
 */
'use strict';
import deepequal from 'deep-equal';

export default function(prev, next) {
    // find out which sessions should be updated
    var sessionsToUpdate = {};
    if (prev.editorFiles !== next.editorFiles) {
        sessionsToUpdate = {...next.sessions};
    } else {
        if (prev.pages !== next.pages) {
            Object.keys(next.pages).forEach(pageUrl => {
                if (!prev.pages[pageUrl] || prev.pages[pageUrl].userMapping !== next.pages[pageUrl].userMapping) {
                    sessionsForPage(pageUrl, next.sessions, sessionsToUpdate);
                }
            });
        }

        if (prev.sessions !== next.sessions) {
            Object.keys(next.sessions).forEach(id => {
                if (!prev.sessions[id] || prev.sessions[id].stylesheets !== next.sessions[id].stylesheets) {
                    sessionsToUpdate[id] = next.sessions;
                }
            });
        }
    }

    var updated = false;
    Object.keys(sessionsToUpdate).forEach(id => {
        var session = next.sessions[id];
        var page = next.pages[session.page];
        // resolve user mappings for user stylestheets: in page they are mapped
        // to persistent stylesheet id while in session they should be mapped to
        // real stylesheet
        var userStylesheets = session.userStylesheets || new Map();
        var userMapping = Object.keys(page.userMapping).reduce((out, browser) => {
            var key = userStylesheets.get(browser) || browser;
            out[key] = page.userMapping[browser];
            return out;
        }, {});
        var mapping = {
            ...autoMap(session.stylesheets, next.editorFiles),
            ...getValidMappings(userMapping, session.stylesheets, next.editorFiles)
        };
        if (!deepequal(session.mapping, mapping)) {
            updated = true;
            sessionsToUpdate[id] = {...session, mapping};
        }
    });

    if (updated) {
        next.sessions = {
            ...next.sessions,
            ...sessionsToUpdate
        };
    }

    return next;
};

export function autoMap(browser=[], editor=[]) {
    return browser.reduce((out, file) => {
        var mapped = autoMapBrowserFile(file, editor);
        if (mapped) {
            out[file] = mapped;
        }
        return out;
    }, []);
};

export function autoMapBrowserFile(file, list) {
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

function sessionsForPage(pageUrl, sessions, out={}) {
    return Object.keys(sessions).reduce((out, key) => {
        if (sessions[key].page === pageUrl) {
            out[key] = sessions[key];
        }
        return out;
    }, out);
}

function pathLookup(path) {
	return path.split('?')[0].split('/').filter(Boolean);
}

function cleanFileName(file) {
	return file.replace(/\.\w+$/, '');
}

function getValidMappings(mappings, browser, editor) {
    browser = new Set(browser);
    editor = new Set(editor);
    return Object.keys(mappings || {}).reduce((out, key) => {
        if (browser.has(key) && editor.has(mappings[key])) {
            out[key] = mappings[key];
        }
        return out;
    }, {});
}
