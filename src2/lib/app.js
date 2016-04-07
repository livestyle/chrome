/**
 * Global LiveStyle extension app
 */
'use strict';

import extensionApp from 'extension-app';
import client from 'livestyle-client';

export default extensionApp(client, {
    logger: process.env.NODE_ENV !== 'production'
});
