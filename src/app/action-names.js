'use strict';

export const PAGE = {
    TOGGLE_ENABLED: 'Toggle page enabled state',
    LAST_USED: 'Updates last used data',
    UPDATE_FILE_MAPPING: 'Explicitly map editor file to browser one',
    UPDATE_DIRECTION: 'Update changes transmit direction',

    DIRECTION_BOTH: 'both',
    DIRECTION_TO_BROWSER: 'to browser',
    DIRECTION_TO_EDITOR: 'to editor'
};

export const SESSION = {
    SET_CSSOM_STYLESHEETS: 'Update list of CSSOM stylesheets',
    SET_DEVTOOLS_STYLESHEETS: 'Update list of DevTools stylesheets',
    UPDATE_STYLESHEETS: 'Update browser stylesheets list',
    UPDATE_AUTO_MAPPING: 'Update browser-to-editor file auto mappings',
    UPDATE_MAPPING: 'Update browser-to-editor file mappings',
    UPDATE_LIST: 'Update sessions list'
};

export const EDITOR = {
    SET_FILES: 'Update list of editor files'
};
