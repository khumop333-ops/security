/**
 * Storage driver selection.
 *
 * - Local development: SQLite via Node's built-in `node:sqlite` (zero
 *   dependencies, file at server/data/panic.db).
 * - Serverless (Vercel): Supabase Postgres when DATABASE_URL is set — a file
 *   database cannot persist across serverless invocations.
 *
 * Every exported function is awaited by callers regardless of driver, so the
 * synchronous SQLite driver and the asynchronous Postgres driver are
 * interchangeable.
 */
const impl = process.env.DATABASE_URL
  ? await import('./db-pg.js')
  : await import('./db-sqlite.js');

export const ACTIVE_STATUSES = impl.ACTIVE_STATUSES;
export const hashPin = impl.hashPin;
export const verifyPin = impl.verifyPin;
export const getProfile = impl.getProfile;
export const updateProfile = impl.updateProfile;
export const listContacts = impl.listContacts;
export const replaceContacts = impl.replaceContacts;
export const setPin = impl.setPin;
export const getPinHash = impl.getPinHash;
export const logDataRequest = impl.logDataRequest;
export const nextAlertCode = impl.nextAlertCode;
export const createAlert = impl.createAlert;
export const getAlert = impl.getAlert;
export const getAlertByCode = impl.getAlertByCode;
export const listAlerts = impl.listAlerts;
export const getActiveAlert = impl.getActiveAlert;
export const addEvent = impl.addEvent;
export const listEvents = impl.listEvents;
export const updateAlertStatus = impl.updateAlertStatus;
export const ping = impl.ping;
export const diagnose = impl.diagnose;
