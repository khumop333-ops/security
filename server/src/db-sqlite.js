/**
 * Persistence layer.
 *
 * The prototype uses SQLite via Node's built-in `node:sqlite` module so it runs
 * with zero native dependencies. The schema mirrors what would migrate 1:1 to
 * PostgreSQL in production (see README, "Production roadmap").
 *
 * All timestamps are stored as ISO-8601 UTC strings and formatted for
 * Africa/Johannesburg on the client.
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPin, verifyPin } from './pin.js';

export { hashPin, verifyPin };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'panic.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

/* ------------------------------------------------------------------ schema */

db.exec(`
  CREATE TABLE IF NOT EXISTS profile (
    id                    INTEGER PRIMARY KEY CHECK (id = 1),
    first_name            TEXT    NOT NULL DEFAULT '',
    surname               TEXT    NOT NULL DEFAULT '',
    id_number             TEXT    NOT NULL DEFAULT '',
    mobile                TEXT    NOT NULL DEFAULT '',
    address               TEXT    NOT NULL DEFAULT '',
    medical_conditions    TEXT    NOT NULL DEFAULT '',
    allergies             TEXT    NOT NULL DEFAULT '',
    contract_number       TEXT    NOT NULL DEFAULT '',
    pin_hash              TEXT    NOT NULL DEFAULT '',
    notify_sms            INTEGER NOT NULL DEFAULT 1,
    notify_whatsapp       INTEGER NOT NULL DEFAULT 0,
    notify_status_updates INTEGER NOT NULL DEFAULT 1,
    popia_consent         INTEGER NOT NULL DEFAULT 0,
    popia_consent_at      TEXT,
    updated_at            TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS emergency_contacts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT NOT NULL,
    phone        TEXT NOT NULL,
    relationship TEXT NOT NULL DEFAULT '',
    position     INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    code            TEXT NOT NULL UNIQUE,
    type            TEXT NOT NULL CHECK (type IN ('panic', 'test')),
    status          TEXT NOT NULL,
    lat             REAL,
    lng             REAL,
    accuracy        REAL,
    address         TEXT NOT NULL DEFAULT '',
    address_source  TEXT NOT NULL DEFAULT 'gps',
    user_name       TEXT NOT NULL DEFAULT '',
    user_id_number  TEXT NOT NULL DEFAULT '',
    user_mobile     TEXT NOT NULL DEFAULT '',
    contract_number TEXT NOT NULL DEFAULT '',
    medical_summary TEXT NOT NULL DEFAULT '',
    eta_minutes     INTEGER,
    responder_name  TEXT NOT NULL DEFAULT '',
    responder_unit  TEXT NOT NULL DEFAULT '',
    cancel_reason   TEXT NOT NULL DEFAULT '',
    resolution_note TEXT NOT NULL DEFAULT '',
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS alert_events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_id   INTEGER NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status  TEXT NOT NULL,
    actor      TEXT NOT NULL CHECK (actor IN ('user', 'control_room', 'system')),
    actor_name TEXT NOT NULL DEFAULT '',
    note       TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  -- POPIA data-subject requests (access / deletion / correction) are logged here.
  CREATE TABLE IF NOT EXISTS data_requests (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    request_type TEXT NOT NULL,
    detail       TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL
  );
`);

/* ------------------------------------------------------------- row mapping */

function mapProfile(row) {
  if (!row) return null;
  const { pin_hash, ...rest } = row;
  return { ...rest, hasPin: Boolean(pin_hash) };
}

function mapAlert(row) {
  return row;
}

/* ------------------------------------------------------------------- seed */

const nowIso = () => new Date().toISOString();
const daysAgoIso = (days, hour = 10, minute = 30) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

function seedIfEmpty() {
  const { c } = db.prepare('SELECT COUNT(*) AS c FROM profile').get();
  if (c > 0) return;

  const now = nowIso();
  db.prepare(`
    INSERT INTO profile (
      id, first_name, surname, id_number, mobile, address,
      medical_conditions, allergies, contract_number, pin_hash,
      notify_sms, notify_whatsapp, notify_status_updates,
      popia_consent, popia_consent_at, updated_at
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 1, 1, ?, ?)
  `).run(
    'Thandi', 'Mokoena', '9001155800081', '+27 82 555 0147',
    '42 Marthinus Pretorius Street, Pretoria Central, 0002',
    'Hypertension — takes enalapril 10 mg daily', 'Penicillin',
    'AR-PTA-104729', hashPin('1234'), now, now
  );

  const insertContact = db.prepare(`
    INSERT INTO emergency_contacts (name, phone, relationship, position) VALUES (?, ?, ?, ?)
  `);
  insertContact.run('Sipho Mokoena', '+27 82 555 0198', 'Brother', 1);
  insertContact.run('Dr Naledi Khumalo', '+27 12 555 0113', 'General practitioner', 2);

  // Three historical alerts so the History screen is populated on first run.
  const insertAlert = db.prepare(`
    INSERT INTO alerts (
      code, type, status, lat, lng, accuracy, address, address_source,
      user_name, user_id_number, user_mobile, contract_number, medical_summary,
      eta_minutes, responder_name, responder_unit, resolution_note,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertEvent = db.prepare(`
    INSERT INTO alert_events (alert_id, from_status, to_status, actor, actor_name, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const history = [
    {
      code: 'AR-261012-001', type: 'panic', status: 'resolved',
      lat: -25.7479, lng: 28.1885, accuracy: 12,
      address: 'Church Square, Pretoria Central, 0002', address_source: 'gps',
      eta: 7, responder: 'Unit R-14', note: 'Responders escorted client. No further assistance required.',
      created: daysAgoIso(17, 21, 14)
    },
    {
      code: 'AR-261005-003', type: 'test', status: 'test_complete',
      lat: -25.7479, lng: 28.1885, accuracy: 20,
      address: '42 Marthinus Pretorius Street, Pretoria Central, 0002', address_source: 'gps',
      eta: null, responder: '', note: 'Test signal — no responders dispatched.',
      created: daysAgoIso(24, 9, 5)
    },
    {
      code: 'AR-260928-002', type: 'panic', status: 'resolved',
      lat: -25.763, lng: 28.221, accuracy: 9,
      address: 'Brooklyn Mall, Brooklyn, 0181', address_source: 'gps',
      eta: 5, responder: 'Unit R-06', note: 'Panic cancelled on scene by client after verification.',
      created: daysAgoIso(31, 18, 42)
    }
  ];

  for (const h of history) {
    const res = insertAlert.run(
      h.code, h.type, h.status, h.lat, h.lng, h.accuracy, h.address, h.address_source,
      'Thandi Mokoena', '9001155800081', '+27 82 555 0147', 'AR-PTA-104729',
      'Hypertension — takes enalapril 10 mg daily | Allergies: Penicillin',
      h.eta, h.responder, '', h.note, h.created, h.created
    );
    const alertId = Number(res.lastInsertRowid);
    insertEvent.run(alertId, null, 'dispatch_notified', 'system', 'Dispatch', 'Alert received by control room.', h.created);
    insertEvent.run(alertId, 'dispatch_notified', 'responder_en_route', 'control_room', 'Control room', 'Responder dispatched.', h.created);
    insertEvent.run(alertId, 'responder_en_route', 'responder_arrived', 'control_room', 'Control room', 'Responder on scene.', h.created);
    insertEvent.run(alertId, 'responder_arrived', h.status, 'control_room', 'Control room', h.note, h.created);
  }
}

seedIfEmpty();

/* ---------------------------------------------------------------- queries */

export function getProfile() {
  return mapProfile(db.prepare('SELECT * FROM profile WHERE id = 1').get());
}

export function updateProfile(fields) {
  const allowed = [
    'first_name', 'surname', 'id_number', 'mobile', 'address',
    'medical_conditions', 'allergies', 'contract_number',
    'notify_sms', 'notify_whatsapp', 'notify_status_updates',
    'popia_consent', 'popia_consent_at'
  ];
  const sets = [];
  const values = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = ?`);
      values.push(typeof fields[key] === 'boolean' ? (fields[key] ? 1 : 0) : fields[key]);
    }
  }
  if (sets.length === 0) return getProfile();
  sets.push('updated_at = ?');
  values.push(nowIso());
  db.prepare(`UPDATE profile SET ${sets.join(', ')} WHERE id = 1`).run(...values);
  return getProfile();
}

export function listContacts() {
  return db.prepare('SELECT * FROM emergency_contacts ORDER BY position, id').all();
}

/** Replace the contact list atomically (max 3 contacts, per product spec). */
export function replaceContacts(contacts) {
  db.exec('DELETE FROM emergency_contacts');
  const stmt = db.prepare(`
    INSERT INTO emergency_contacts (name, phone, relationship, position) VALUES (?, ?, ?, ?)
  `);
  contacts.slice(0, 3).forEach((c, i) => {
    stmt.run(c.name || '', c.phone || '', c.relationship || '', i + 1);
  });
  return listContacts();
}

export function setPin(newPin) {
  db.prepare('UPDATE profile SET pin_hash = ?, updated_at = ? WHERE id = 1')
    .run(hashPin(newPin), nowIso());
}

export function getPinHash() {
  return db.prepare('SELECT pin_hash FROM profile WHERE id = 1').get().pin_hash;
}

export function logDataRequest(requestType, detail) {
  db.prepare('INSERT INTO data_requests (request_type, detail, created_at) VALUES (?, ?, ?)')
    .run(requestType, detail || '', nowIso());
}

/* ----------------------------------------------------------------- alerts */

/** Statuses that mean "responders are actively working this alert". */
export const ACTIVE_STATUSES = ['dispatch_notified', 'responder_en_route', 'responder_arrived'];

export function nextAlertCode() {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const { c } = db.prepare("SELECT COUNT(*) AS c FROM alerts WHERE code LIKE ?").get(`AR-${ymd}-%`);
  return `AR-${ymd}-${String(c + 1).padStart(3, '0')}`;
}

export function createAlert({ type, lat, lng, accuracy, address, addressSource }) {
  const profile = db.prepare('SELECT * FROM profile WHERE id = 1').get();
  const medical = [
    profile.medical_conditions ? `Conditions: ${profile.medical_conditions}` : '',
    profile.allergies ? `Allergies: ${profile.allergies}` : ''
  ].filter(Boolean).join(' | ');

  const now = nowIso();
  const status = type === 'test' ? 'test_complete' : 'dispatch_notified';

  const res = db.prepare(`
    INSERT INTO alerts (
      code, type, status, lat, lng, accuracy, address, address_source,
      user_name, user_id_number, user_mobile, contract_number, medical_summary,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    nextAlertCode(), type, status,
    lat ?? null, lng ?? null, accuracy ?? null,
    address || '', addressSource || 'gps',
    `${profile.first_name} ${profile.surname}`.trim(), profile.id_number, profile.mobile,
    profile.contract_number, medical, now, now
  );

  const alertId = Number(res.lastInsertRowid);
  addEvent(alertId, null, status, 'system', 'System',
    type === 'test'
      ? 'Test signal recorded. No responders dispatched.'
      : 'Alert received. Dispatch notified.');

  // Simulated gateway: in production this posts to the dispatch platform and
  // an SMS/WhatsApp provider (see README, "Production roadmap").
  if (type === 'panic') {
    const contacts = listContacts();
    const profileFull = getProfile();
    for (const c of contacts) {
      const channel = profileFull.notify_whatsapp ? 'WhatsApp' : 'SMS';
      addEvent(alertId, status, status, 'system', 'Notification gateway',
        `${channel} notification sent to ${c.name} (${c.phone}) — simulated gateway.`);
    }
  }

  return getAlert(alertId);
}

export function getAlert(id) {
  const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id);
  return alert ? mapAlert(alert) : null;
}

export function getAlertByCode(code) {
  return db.prepare('SELECT * FROM alerts WHERE code = ?').get(code) || null;
}

export function listAlerts({ limit = 50, offset = 0, filter } = {}) {
  let sql = 'SELECT * FROM alerts';
  const params = [];
  if (filter === 'active') {
    sql += ` WHERE status IN (${ACTIVE_STATUSES.map(() => '?').join(',')})`;
    params.push(...ACTIVE_STATUSES);
  } else if (filter === 'test') {
    sql += " WHERE type = 'test'";
  }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  return db.prepare(sql).all(...params).map(mapAlert);
}

export function getActiveAlert() {
  return db.prepare(`
    SELECT * FROM alerts WHERE status IN (${ACTIVE_STATUSES.map(() => '?').join(',')})
    ORDER BY created_at DESC LIMIT 1
  `).get(...ACTIVE_STATUSES) || null;
}

export function addEvent(alertId, fromStatus, toStatus, actor, actorName, note) {
  db.prepare(`
    INSERT INTO alert_events (alert_id, from_status, to_status, actor, actor_name, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(alertId, fromStatus ?? null, toStatus, actor, actorName || '', note || '', nowIso());
}

export function listEvents(alertId) {
  return db.prepare('SELECT * FROM alert_events WHERE alert_id = ? ORDER BY created_at, id').all(alertId);
}

/**
 * Move an alert to a new status with optional dispatch metadata.
 * Returns the updated alert, or throws { statusCode, code, message }.
 */
export function updateAlertStatus(id, {
  status, etaMinutes, responderName, responderUnit, note, operatorName, cancelReason, actor = 'control_room'
}) {
  const alert = getAlert(id);
  if (!alert) {
    const err = new Error('Alert not found.');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const allowedNext = {
    dispatch_notified: ['responder_en_route', 'resolved', 'cancelled'],
    responder_en_route: ['responder_arrived', 'resolved', 'cancelled'],
    responder_arrived: ['resolved', 'cancelled'],
    resolved: [],
    cancelled: [],
    test_complete: []
  };
  if (!allowedNext[alert.status]?.includes(status)) {
    const err = new Error(`Cannot move alert from "${alert.status}" to "${status}".`);
    err.statusCode = 409;
    err.code = 'INVALID_TRANSITION';
    throw err;
  }

  const now = nowIso();
  db.prepare(`
    UPDATE alerts SET
      status = ?,
      eta_minutes = COALESCE(?, eta_minutes),
      responder_name = CASE WHEN ? != '' THEN ? ELSE responder_name END,
      responder_unit = CASE WHEN ? != '' THEN ? ELSE responder_unit END,
      cancel_reason = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE cancel_reason END,
      resolution_note = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE resolution_note END,
      updated_at = ?
    WHERE id = ?
  `).run(
    status,
    etaMinutes ?? null,
    responderName || '', responderName || '',
    responderUnit || '', responderUnit || '',
    cancelReason ?? '', cancelReason ?? '', cancelReason ?? '',
    note ?? '', note ?? '', note ?? '',
    now, id
  );

  addEvent(id, alert.status, status, actor, operatorName || (actor === 'user' ? 'Client' : 'Control room'), note || '');
  return getAlert(id);
}

export default db;
