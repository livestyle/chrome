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
            userMapping: {}
        }
    },

    // Hash of currenlty active LiveStyle sessions per opened tabs (key is a tab ID)
    sessions: {
        '187': {
            // Reference to page in `pages` key
            page: 'http://example.com:9000/test.html',

            // array of stylesheets available for current page, calculated
            // value from `cssomStylesheets` and `devtoolsStylesheets`
            stylesheets: [],

            // list of stylesheets retreived from CSSOM, might be falsy
            // if its currently fetching
            cssomStylesheets: [],

            // list of stylesheets retreived from DevTools, might be falsy
            // if its currently fetching
            devtoolsStylesheets: [],

            // Browser-to-editor file mapping, calculated from `autoMapping` and
            // `userMapping` of matched `pages` model
            mapping: {},

            // Browser-to-editor file mappings “guessed” by LiveStyle. Will be
            // used if there’s no user mapping for given browser file or
            // user-mapped editor file is not yet opened in editor
            autoMapping: {}
        }
    },

    // List of errors appeared during LiveStyle sessions
    errors: [{
        // A timestamp when error appeared
        time: 1456088041245,

        // A page where error appeared (key of `pages` model)
        page: 'http://example.com:9000/test.html',
        error: null
    }]
};
