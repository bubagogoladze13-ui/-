// Picks where the journal is stored: online (Supabase) when configured, otherwise this device.
import * as local from './db-local.js';
import * as remote from './db-remote.js';
import { hasRemote } from './supabase.js';

const store = hasRemote ? remote : local;

export const allMessages = (...a) => store.allMessages(...a);
export const messageIds = (...a) => store.messageIds(...a);
export const putMessages = (...a) => store.putMessages(...a);
export const hasFile = (...a) => store.hasFile(...a);
export const putFile = (...a) => store.putFile(...a);
export const getFile = (...a) => store.getFile(...a);
export const getUrl = (...a) => store.getUrl(...a);
export const clearAll = (...a) => store.clearAll(...a);
