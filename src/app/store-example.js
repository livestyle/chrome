/**
 * References data for Redux store
 */
'use strict';

export default const = {
    // List of stylesheet files currently available in opened editor
    editorFiles: [],

    // Persistent storage of active pages (URL) models
    pages: {
        'http://example.com:9000/test.html': {
            // LiveStyle is enabled for given page
            enabled: true,

            // Update direction, see `PAGE.DIRECTION_*` in action names
            direction: 'both',

            // When this session was used last time, used to auto-remove old sessions
            lastUsed: 1456088041245,

            // Browser-to-editor file mapping, hand-picked by user
            userMapping: {},

            // IDs of user-generated styleshets
            userStylesheets: []
        }
    },

    // Hash of currenlty active LiveStyle sessions per opened tabs (key is a tab ID)
    sessions: {
        '187': {
            // Reference to page in `pages` key
            page: 'http://example.com:9000/test.html',

            // current session origin
            origin: 'http://example.com:9000',

            // array of stylesheets available for current page, calculated
            // value from `cssomStylesheets` and `devtoolsStylesheets`
            stylesheets: [],

            // list of stylesheets retreived from CSSOM, might be falsy
            // if its currently fetching
            cssomStylesheets: [],

            // Map of stylesheets (url + content) retreived from DevTools
            devtoolsStylesheets: new Map(),

            // Map of user stylesheets (persistent ID => page-local URL)
            userStylesheets: new Map(),

            // Browser-to-editor file mapping, automatically calculated from
            // `editorFiles`, `pages.userMapping` and `session.stylesheets`
            mapping: {},

            // List of resource patches applied to given session. Mostly used by
            // DevTools: session accumulates all incoming patches in this map
            // (key is resource URI, value are patches) and DevTools,
            // when connected or synchronized, will use these patches to update
            // resources accordingly and then remove applied patches
            patches: new Map(),

            // List of editor files that were requested for unsaved changes
            requestedUnsavedFiles: new Set()
        }
    },

    // List of errors appeared during LiveStyle sessions
    errors: [{
        // A timestamp when error appeared
        time: 1456088041245,

        // A page where error appeared (key of `pages` model)
        page: 'http://example.com:9000/test.html',
        error: null
    }],

    // Remote View state and sessions
    removeView: {
        // Wether current browser client is connected to LiveStyle App
        connected: true,

        // Currently active Remote View sessions, Map
        sessions: {
            // Key is a session origin
            'http://localhost:8080': {
                // current session connection state, see REMOTE_VIEW.STATE_*
                state: 'connected',
                publicId: 'rv.livestyle.io',
				localSite: 'http://localhost:8080',
				connectUrl: 'http://livestyle.io:9001',
				expiresAt: Date.now(),
            }
        }
    }
};
