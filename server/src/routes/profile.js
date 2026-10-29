/**
 * Profile, emergency contacts, PIN management and POPIA data-subject requests.
 */
import { Router } from 'express';
import {
  getPinHash, getProfile, listContacts, logDataRequest, replaceContacts,
  setPin, updateProfile, verifyPin
} from '../db.js';

const router = Router();

/** Profile fields the client is allowed to write (never PIN via this route). */
const PROFILE_FIELDS = [
  'first_name', 'surname', 'id_number', 'mobile', 'address',
  'medical_conditions', 'allergies', 'contract_number',
  'notify_sms', 'notify_whatsapp', 'notify_status_updates',
  'popia_consent'
];

router.get('/profile', (req, res) => {
  return res.json({ profile: getProfile(), contacts: listContacts() });
});

router.put('/profile', (req, res) => {
  const { profile: profileUpdate, contacts } = req.body || {};

  const fields = {};
  if (profileUpdate && typeof profileUpdate === 'object') {
    for (const key of PROFILE_FIELDS) {
      if (profileUpdate[key] !== undefined) fields[key] = profileUpdate[key];
    }
  }

  // POPIA: consent is recorded with a timestamp so it can be audited.
  if (fields.popia_consent === true || fields.popia_consent === 1) {
    fields.popia_consent_at = getProfile().popia_consent_at || new Date().toISOString();
  }

  const profile = updateProfile(fields);

  let savedContacts = listContacts();
  if (Array.isArray(contacts)) {
    if (contacts.length > 3) {
      return res.status(400).json({
        error: { code: 'TOO_MANY_CONTACTS', message: 'A maximum of 3 emergency contacts is supported.' }
      });
    }
    savedContacts = replaceContacts(contacts.map((c) => ({
      name: String(c.name || '').slice(0, 120),
      phone: String(c.phone || '').slice(0, 40),
      relationship: String(c.relationship || '').slice(0, 80)
    })));
  }

  return res.json({ profile, contacts: savedContacts });
});

/* --------------------------------------------------------------- PIN */

router.post('/pin/verify', (req, res) => {
  const { pin } = req.body || {};
  const ok = Boolean(pin) && verifyPin(pin, getPinHash());
  return res.status(ok ? 200 : 401).json(
    ok ? { ok: true } : { error: { code: 'INVALID_PIN', message: 'Incorrect PIN.' } }
  );
});

router.put('/pin', (req, res) => {
  const { currentPin, newPin } = req.body || {};
  if (!currentPin || !verifyPin(currentPin, getPinHash())) {
    return res.status(401).json({ error: { code: 'INVALID_PIN', message: 'Current PIN is incorrect.' } });
  }
  const pinText = String(newPin ?? '');
  if (!/^\d{4,6}$/.test(pinText)) {
    return res.status(400).json({
      error: { code: 'INVALID_NEW_PIN', message: 'New PIN must be 4 to 6 digits.' }
    });
  }
  setPin(pinText);
  return res.json({ ok: true });
});

/* ------------------------------------------------------- POPIA requests */

router.post('/privacy/requests', (req, res) => {
  const { requestType, detail } = req.body || {};
  const allowed = ['access', 'deletion', 'correction'];
  if (!allowed.includes(requestType)) {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST_TYPE', message: `Request type must be one of: ${allowed.join(', ')}.` }
    });
  }
  logDataRequest(requestType, String(detail || '').slice(0, 1000));
  return res.status(201).json({
    ok: true,
    message: 'Your request has been logged. The information officer will contact you within 30 days as required by POPIA.'
  });
});

export default router;
