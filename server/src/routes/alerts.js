/**
 * User-facing alert API: trigger panic/test alerts, view history, cancel with PIN.
 */
import { Router } from 'express';
import {
  ACTIVE_STATUSES, addEvent, createAlert, getActiveAlert, getAlert, getPinHash,
  listAlerts, listEvents, updateAlertStatus, verifyPin
} from '../db.js';
import { broadcast } from '../ws-hub.js';

const router = Router();

/** 400 helper — consistent error envelope for the client. */
function badRequest(res, message, code = 'BAD_REQUEST') {
  return res.status(400).json({ error: { code, message } });
}

/* ----------------------------------------------------------- create alert */

router.post('/alerts', (req, res) => {
  const { type = 'panic', lat, lng, accuracy, address, addressSource } = req.body || {};

  if (!['panic', 'test'].includes(type)) {
    return badRequest(res, 'Alert type must be "panic" or "test".', 'INVALID_TYPE');
  }

  // One active panic at a time — matches the app's single-alert state machine.
  const active = getActiveAlert();
  if (active) {
    return res.status(409).json({
      error: {
        code: 'ACTIVE_ALERT_EXISTS',
        message: 'An alert is already active. View its status before starting another.'
      },
      alert: active
    });
  }

  const alert = createAlert({
    type,
    lat: typeof lat === 'number' ? lat : null,
    lng: typeof lng === 'number' ? lng : null,
    accuracy: typeof accuracy === 'number' ? accuracy : null,
    address: typeof address === 'string' ? address.slice(0, 500) : '',
    addressSource: ['gps', 'last_known', 'manual'].includes(addressSource) ? addressSource : 'gps'
  });

  broadcast({ type: 'alert.created', alert });
  return res.status(201).json({ alert, events: listEvents(alert.id) });
});

/* --------------------------------------------------------------- queries */

router.get('/alerts/active', (req, res) => {
  const alert = getActiveAlert();
  return res.json({ alert: alert || null });
});

router.get('/alerts', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const offset = parseInt(req.query.offset, 10) || 0;
  return res.json({ alerts: listAlerts({ limit, offset }) });
});

router.get('/alerts/:id', (req, res) => {
  const alert = getAlert(Number(req.params.id));
  if (!alert) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Alert not found.' } });
  return res.json({ alert, events: listEvents(alert.id) });
});

/* ------------------------------------------------- cancel (false alarm) */

router.post('/alerts/:id/cancel', (req, res) => {
  const alert = getAlert(Number(req.params.id));
  if (!alert) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Alert not found.' } });

  const { pin, reason } = req.body || {};
  if (!pin || !verifyPin(pin, getPinHash())) {
    return res.status(401).json({ error: { code: 'INVALID_PIN', message: 'Incorrect PIN.' } });
  }
  if (!ACTIVE_STATUSES.includes(alert.status)) {
    return res.status(409).json({ error: { code: 'NOT_ACTIVE', message: 'This alert is no longer active.' } });
  }

  const updated = updateAlertStatus(alert.id, {
    status: 'cancelled',
    actor: 'user',
    operatorName: 'Client (PIN verified)',
    cancelReason: typeof reason === 'string' ? reason.slice(0, 300) : '',
    note: reason ? `Cancelled by client. Reason: ${reason}` : 'Cancelled by client.'
  });

  broadcast({ type: 'alert.updated', alert: updated });
  return res.json({ alert: updated, events: listEvents(updated.id) });
});

export default router;
