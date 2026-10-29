/**
 * Control-room (dispatch) API: alert queue, status advancement, demo simulator.
 *
 * NOTE: The prototype has no operator authentication. In production this
 * router must sit behind operator login (JWT + role checks) and an audit trail.
 */
import { Router } from 'express';
import {
  addEvent, createAlert, getAlert, listAlerts, listEvents, updateAlertStatus
} from '../db.js';
import { broadcast } from '../ws-hub.js';

const router = Router();

/** Statuses the control room may set, and what the client UI labels them. */
const DISPATCHABLE_STATUSES = ['responder_en_route', 'responder_arrived', 'resolved', 'cancelled'];

router.get('/dispatch/alerts', (req, res) => {
  const filter = ['active', 'test', 'recent'].includes(req.query.filter) ? req.query.filter : undefined;
  const alerts = listAlerts({ limit: 100, filter });
  return res.json({ alerts });
});

router.get('/dispatch/alerts/:id', (req, res) => {
  const alert = getAlert(Number(req.params.id));
  if (!alert) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Alert not found.' } });
  return res.json({ alert, events: listEvents(alert.id) });
});

router.post('/dispatch/alerts/:id/status', (req, res) => {
  const {
    status, etaMinutes, responderName, responderUnit, note, operatorName, cancelReason
  } = req.body || {};

  if (!DISPATCHABLE_STATUSES.includes(status)) {
    return res.status(400).json({
      error: { code: 'INVALID_STATUS', message: `Status must be one of: ${DISPATCHABLE_STATUSES.join(', ')}.` }
    });
  }

  try {
    const alert = updateAlertStatus(Number(req.params.id), {
      status,
      etaMinutes: Number.isFinite(Number(etaMinutes)) ? Math.max(0, Math.round(Number(etaMinutes))) : null,
      responderName: String(responderName || '').slice(0, 120),
      responderUnit: String(responderUnit || '').slice(0, 120),
      note: String(note || '').slice(0, 500),
      cancelReason: String(cancelReason || '').slice(0, 300),
      operatorName: String(operatorName || '').slice(0, 120),
      actor: 'control_room'
    });
    broadcast({ type: 'alert.updated', alert });
    return res.json({ alert, events: listEvents(alert.id) });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      error: { code: err.code || 'SERVER_ERROR', message: err.message }
    });
  }
});

/**
 * Demo helper: generate an incoming panic alert at a random Pretoria location
 * so the dispatch queue can be exercised without a second device. Clearly
 * flagged as a simulation in the UI.
 */
router.post('/dispatch/simulate', (req, res) => {
  const operatorName = String((req.body || {}).operatorName || '').slice(0, 120);

  // Random point around Pretoria CBD / Hatfield / Brooklyn.
  const anchors = [
    { lat: -25.7479, lng: 28.1885, area: 'Church Square, Pretoria Central' },
    { lat: -25.748, lng: 28.235, area: 'Lynnwood Road, Hatfield' },
    { lat: -25.763, lng: 28.221, area: 'Brooklyn Mall, Brooklyn' },
    { lat: -25.774, lng: 28.281, area: 'Simon Vermooten Road, Pretoria East' }
  ];
  const anchor = anchors[Math.floor(Math.random() * anchors.length)];
  const jitter = (n) => n + (Math.random() - 0.5) * 0.01;

  const alert = createAlert({
    type: 'panic',
    lat: jitter(anchor.lat),
    lng: jitter(anchor.lng),
    accuracy: Math.round(5 + Math.random() * 25),
    address: anchor.area,
    addressSource: 'gps'
  });

  broadcast({ type: 'alert.created', alert });
  if (operatorName) {
    // Note who ran the simulation for the audit trail.
    addEvent(alert.id, 'dispatch_notified', 'dispatch_notified', 'control_room', operatorName,
      'Demo simulation generated from dispatch console.');
  }

  return res.status(201).json({ alert, events: listEvents(alert.id) });
});

export default router;
