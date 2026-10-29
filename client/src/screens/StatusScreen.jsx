/**
 * Live status screen.
 *
 * Shows the alert progression (Dispatch Notified → Responder En Route →
 * Responder Arrived → Resolved), ETA when available, the location sent with
 * the alert, and the PIN-guarded "cancel / false alarm" action.
 *
 * Updates arrive over WebSocket; screens re-fetch on `refresh` as the polling
 * fallback so the status stays current on any network.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Check, Circle, MapPin, Phone, Radio, ShieldAlert, XCircle
} from 'lucide-react';

import { Modal, PinModal } from '../components/PinModal.jsx';
import { api } from '../lib/api.js';
import { createLiveClient } from '../lib/live.js';
import { mapsLink } from '../lib/geo.js';
import {
  COMPANY, formatDateTime, formatTime, isActiveStatus, STATUS_LABELS, statusBadgeVariant
} from '../lib/format.js';

const PANIC_STAGES = [
  { key: 'dispatch_notified', title: 'Dispatch Notified', desc: 'The control room has received your alert.' },
  { key: 'responder_en_route', title: 'Responder En Route', desc: 'A responder has been dispatched to your location.' },
  { key: 'responder_arrived', title: 'Responder Arrived', desc: 'The responder is at your location.' },
  { key: 'resolved', title: 'Resolved', desc: 'The situation has been resolved.' }
];

export function StatusScreen() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [alert, setAlert] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [liveStatus, setLiveStatus] = useState('connecting');

  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('Accidental activation');
  const [showPin, setShowPin] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      let data;
      if (id) {
        data = await api.getAlert(id);
      } else {
        const { alert: active } = await api.getActiveAlert();
        if (!active) {
          navigate('/', { replace: true });
          return;
        }
        data = await api.getAlert(active.id);
      }
      setAlert(data.alert);
      setEvents(data.events || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Unable to load the alert.');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    load();
    const unsubscribe = createLiveClient({
      onMessage: (msg) => {
        if (msg.type === 'refresh') {
          load();
        } else if (msg.type === 'alert.updated' || msg.type === 'alert.created') {
          if (!id || String(msg.alert?.id) === String(id)) load();
        }
      },
      onStatus: setLiveStatus
    });
    return unsubscribe;
  }, [load, id]);

  async function verifyAndCancel(pin) {
    await api.cancelAlert(alert.id, pin, cancelReason);
    setShowPin(false);
    setShowCancel(false);
    setNotice('Alert cancelled. Dispatch has been informed that no response is required.');
    load();
  }

  if (loading) {
    return <div className="page"><div className="empty-state">Loading alert status…</div></div>;
  }

  if (error || !alert) {
    return (
      <div className="page">
        <div className="notice notice--error" role="alert">
          <XCircle size={22} className="notice__icon" aria-hidden="true" />
          <div>
            <div className="notice__title">Unable to show this alert</div>
            <div>{error || 'Alert not found.'}</div>
            <div style={{ marginTop: 12 }}>
              <Link to="/history" className="btn btn--secondary">Back to history</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const active = isActiveStatus(alert.status);
  const eventFor = (status) => events.find((e) => e.to_status === status);
  const currentStageIndex = PANIC_STAGES.findIndex((s) => s.key === alert.status);

  return (
    <div className="page">
      {/* Headline status */}
      <section className={`card ${active ? 'card--navy' : ''}`} aria-label="Alert status">
        <div className="row-between">
          <div>
            <div className="card__title">{alert.type === 'test' ? 'Test alert' : 'Alert'} {alert.code}</div>
            <h1 style={{ color: active ? '#FFFFFF' : undefined }}>
              {active ? 'Help is on the way' : STATUS_LABELS[alert.status]}
            </h1>
            <div className="small" style={{ color: active ? 'rgba(255,255,255,0.85)' : 'var(--text-muted)', marginTop: 4 }}>
              Sent {formatDateTime(alert.created_at)}
            </div>
          </div>
          <span className={`badge ${active ? 'badge--progress' : `badge--${statusBadgeVariant(alert.status)}`}`}
            style={active ? { background: '#FFFFFF', color: 'var(--navy)', border: 'none' } : undefined}>
            {STATUS_LABELS[alert.status]}
          </span>
        </div>

        {active && (
          <div className="row" style={{ marginTop: 12, gap: 8 }}>
            <Radio size={18} aria-hidden="true" />
            <span className="small">
              {liveStatus === 'live' ? `Live updates active — ${formatTime(new Date().toISOString())}`
                : liveStatus === 'polling' ? 'Live connection unavailable — polling for updates'
                : 'Reconnecting to live updates…'}
            </span>
          </div>
        )}

        {alert.eta_minutes != null && alert.status === 'responder_en_route' && (
          <div style={{ marginTop: 14, fontSize: 18, fontWeight: 600 }}>
            Estimated response time: {alert.eta_minutes} minutes
          </div>
        )}
        {alert.responder_unit ? (
          <div className="small" style={{ color: active ? 'rgba(255,255,255,0.85)' : 'var(--text-muted)', marginTop: 6 }}>
            Responder: {alert.responder_unit}{alert.responder_name ? ` — ${alert.responder_name}` : ''}
          </div>
        ) : null}
      </section>

      {notice ? (
        <div className="notice notice--navy" role="status">
          <Check size={22} className="notice__icon" aria-hidden="true" />
          <div>{notice}</div>
        </div>
      ) : null}

      {alert.type === 'test' ? (
        <div className="notice" role="status">
          <ShieldAlert size={22} className="notice__icon" aria-hidden="true" />
          <div>
            <div className="notice__title">Test signal complete</div>
            <div>
              This was a test. No responders were dispatched. The control room recorded the test signal
              at {formatDateTime(alert.created_at)}.
            </div>
          </div>
        </div>
      ) : null}

      {alert.status === 'cancelled' ? (
        <div className="notice" role="status">
          <XCircle size={22} className="notice__icon" aria-hidden="true" />
          <div>
            <div className="notice__title">Alert cancelled</div>
            <div>
              {alert.cancel_reason ? `Reason: ${alert.cancel_reason}. ` : ''}
              Dispatch was instructed to stand down. If this was a mistake, call the control room
              immediately on {COMPANY.controlRoomPhone}.
            </div>
          </div>
        </div>
      ) : null}

      {/* Progress stepper */}
      {alert.type !== 'test' && (
        <section className="card" aria-label="Response progress">
          <div className="card__title">Response progress</div>
          <ol className="stepper">
            {PANIC_STAGES.map((stage, i) => {
              const ev = eventFor(stage.key);
              const done = Boolean(ev) || (alert.status === 'cancelled' && i === 0);
              const current = alert.status === stage.key && active;
              const stateClass = done ? 'stepper__item--done' : current ? 'stepper__item--current' : 'stepper__item--pending';
              return (
                <li key={stage.key} className={`stepper__item ${stateClass}`}>
                  <div className="stepper__rail">
                    <div className="stepper__dot">
                      {done ? <Check size={15} strokeWidth={2.5} aria-hidden="true" />
                        : current ? <Circle size={11} fill="currentColor" aria-hidden="true" />
                        : null}
                    </div>
                    {i < PANIC_STAGES.length - 1 && <div className="stepper__line" />}
                  </div>
                  <div className="stepper__body">
                    <div className="stepper__title">{stage.title}</div>
                    <div className="stepper__meta">
                      {ev ? formatDateTime(ev.created_at) : stage.desc}
                      {ev && ev.note ? ` — ${ev.note}` : ''}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Location sent with the alert */}
      <section className="card" aria-label="Alert location">
        <div className="card__title">Location sent to dispatch</div>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <MapPin size={22} aria-hidden="true" style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 500 }}>
              {alert.address || 'Address not available — coordinates only'}
            </div>
            {alert.lat != null && (
              <div className="small muted mono" style={{ marginTop: 2 }}>
                {alert.lat.toFixed(5)}, {alert.lng.toFixed(5)}
                {alert.accuracy ? ` — accuracy ${Math.round(alert.accuracy)} m` : ''}
                {alert.address_source === 'manual' ? ' — address entered manually' : ''}
              </div>
            )}
          </div>
        </div>
        {alert.lat != null && (
          <a
            className="btn btn--quiet"
            style={{ marginTop: 12 }}
            href={mapsLink(alert.lat, alert.lng)}
            target="_blank"
            rel="noreferrer"
          >
            Open in map
          </a>
        )}
      </section>

      {/* Notifications log (simulated gateway, shown for transparency) */}
      {events.some((e) => e.actor === 'system' && e.note.includes('notification sent')) && (
        <section className="card" aria-label="Notifications">
          <div className="card__title">Emergency contacts notified</div>
          <div className="stack-sm">
            {events
              .filter((e) => e.actor === 'system' && e.note.includes('notification sent'))
              .map((e) => (
                <div key={e.id} className="small" style={{ display: 'flex', gap: 8 }}>
                  <Check size={16} aria-hidden="true" style={{ marginTop: 2, flexShrink: 0 }} />
                  <span>{e.note}</span>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Actions */}
      <section className="stack" aria-label="Alert actions">
        <a className="btn btn--secondary btn--block" href={`tel:${COMPANY.controlRoomPhone.replace(/\s/g, '')}`}>
          <Phone size={18} aria-hidden="true" />
          Call control room
        </a>
        {active && (
          <button type="button" className="btn btn--quiet btn--block" onClick={() => setShowCancel(true)}>
            <XCircle size={18} aria-hidden="true" />
            Cancel alert (false alarm)
          </button>
        )}
        {!active && (
          <Link to="/" className="btn btn--primary btn--block">Return home</Link>
        )}
      </section>

      {/* Cancel flow: reason first, then PIN to confirm */}
      {showCancel && !showPin && (
        <Modal
          title="Cancel this alert?"
          onClose={() => setShowCancel(false)}
          actions={(
            <>
              <button type="button" className="btn btn--primary btn--block" onClick={() => setShowPin(true)}>
                Continue
              </button>
              <button type="button" className="btn btn--quiet btn--block" onClick={() => setShowCancel(false)}>
                Keep alert active
              </button>
            </>
          )}
        >
          <p className="modal__body">
            Cancelling tells the control room that no response is required. A PIN is required to prevent
            misuse. Select a reason:
          </p>
          <div className="field">
            {['Accidental activation', 'Test or training', 'Situation resolved by me', 'Other'].map((r) => (
              <label key={r} className="checkbox-row" style={{ minHeight: 44 }}>
                <input
                  type="radio"
                  name="cancel-reason"
                  value={r}
                  checked={cancelReason === r}
                  onChange={() => setCancelReason(r)}
                />
                <span>{r}</span>
              </label>
            ))}
          </div>
        </Modal>
      )}

      {showPin && (
        <PinModal
          title="Confirm cancellation"
          body="Enter your 4-digit PIN to cancel this alert."
          onCancel={() => setShowPin(false)}
          onVerify={verifyAndCancel}
        />
      )}
    </div>
  );
}
