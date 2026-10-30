/**
 * Home / Panic screen.
 *
 * Layout priority: the panic button dominates; everything else supports it
 * (location confirmation strip, active-alert banner, emergency numbers).
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle, Check, Crosshair, MapPin, Phone, RefreshCw, ShieldCheck
} from 'lucide-react';

import { PanicButton } from '../components/PanicButton.jsx';
import { Modal } from '../components/PinModal.jsx';
import { api } from '../lib/api.js';
import { describeFix, resolvePosition } from '../lib/geo.js';
import { COMPANY, EMERGENCY_NUMBERS, formatShort } from '../lib/format.js';

export function Home() {
  const navigate = useNavigate();

  const [fix, setFix] = useState(null);            // last resolved position
  const [manualAddress, setManualAddress] = useState('');
  const [locating, setLocating] = useState(true);
  const [showManual, setShowManual] = useState(false);
  const [manualDraft, setManualDraft] = useState('');

  const [activeAlert, setActiveAlert] = useState(null);
  const [phase, setPhase] = useState('idle');      // idle | sending | error
  const [sendStep, setSendStep] = useState(0);     // 0..3 progress during send
  const [sendError, setSendError] = useState('');

  const locate = useCallback(async (addressOverride) => {
    setLocating(true);
    const resolved = await resolvePosition({ manualAddress: addressOverride ?? manualAddress });
    setFix(resolved);
    setLocating(false);
    return resolved;
  }, [manualAddress]);

  // Initial load: location + any active alert (e.g. after a page reload).
  useEffect(() => {
    let mounted = true;
    (async () => {
      const resolved = await resolvePosition({ manualAddress: '' });
      if (!mounted) return;
      setFix(resolved);
      setLocating(false);
      try {
        const { alert } = await api.getActiveAlert();
        if (mounted) setActiveAlert(alert);
      } catch {
        /* banner simply stays hidden */
      }
    })();
    return () => { mounted = false; };
  }, []);

  async function handleActivate() {
    setPhase('sending');
    setSendStep(1);
    setSendError('');

    try {
      // 1. Capture location (GPS with documented fallbacks).
      const position = await resolvePosition({ manualAddress });
      setFix(position);
      setSendStep(2);

      // 2. Send the alert to dispatch.
      const { alert } = await api.createAlert({
        type: 'panic',
        lat: position.lat,
        lng: position.lng,
        accuracy: position.accuracy,
        address: position.address,
        addressSource: position.addressSource
      });
      setSendStep(3);

      // 3. Confirmation: hand over to the live status screen.
      navigate(`/status/${alert.id}`);
    } catch (err) {
      if (err.code === 'ACTIVE_ALERT_EXISTS' && err.payload?.alert) {
        navigate(`/status/${err.payload.alert.id}`);
        return;
      }
      setSendError(err.message || 'The alert could not be sent.');
      setPhase('error');
    }
  }

  const fixSummary = describeFix(fix);

  return (
    <div className="page">
      {activeAlert ? (
        <div className="notice notice--navy" role="status">
          <ShieldCheck size={22} className="notice__icon" aria-hidden="true" />
          <div>
            <div className="notice__title">An alert is active</div>
            <div>
              {activeAlert.code} — sent {formatShort(activeAlert.created_at)}.{' '}
              <Link to={`/status/${activeAlert.id}`}>View live status</Link>
            </div>
          </div>
        </div>
      ) : null}

      {/* Location confirmation strip */}
      <section className="card" aria-label="Current location">
        <div className="card__title">Current location</div>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <MapPin size={22} aria-hidden="true" style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>
              {locating ? 'Acquiring GPS location…' : fixSummary.title}
            </div>
            <div className="small muted" style={{ marginTop: 2 }}>
              {locating
                ? 'Please wait. You can still press PANIC — the alert will include your best available location.'
                : fixSummary.detail}
            </div>
            {fix && fix.accuracy ? (
              <div className="small muted" style={{ marginTop: 2 }}>
                Accuracy approximately {Math.round(fix.accuracy)} m
                {fix.source === 'last_known' ? ' — last known position' : ''}
              </div>
            ) : null}
          </div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" className="btn btn--quiet" onClick={() => locate()}>
            <RefreshCw size={18} aria-hidden="true" />
            Refresh
          </button>
          <button
            type="button"
            className="btn btn--quiet"
            onClick={() => {
              setManualDraft(manualAddress);
              setShowManual(true);
            }}
          >
            <Crosshair size={18} aria-hidden="true" />
            Enter address
          </button>
        </div>
      </section>

      {/* Panic action */}
      {phase === 'idle' && (
        <PanicButton disabled={false} onActivate={handleActivate} />
      )}

      {phase === 'sending' && (
        <section className="card card--navy" aria-label="Sending alert">
          <div className="card__title">Sending alert</div>
          <div className="send-steps">
            <SendStep done={sendStep >= 1} label="Capturing your location" />
            <SendStep done={sendStep >= 2} label={`Notifying ${COMPANY.name} dispatch`} />
            <SendStep done={sendStep >= 3} label="Notifying your emergency contacts" />
          </div>
        </section>
      )}

      {phase === 'error' && (
        <section className="notice notice--error" role="alert">
          <AlertCircle size={22} className="notice__icon" aria-hidden="true" />
          <div>
            <div className="notice__title">Alert could not be sent</div>
            <div>{sendError}</div>
            <div className="row" style={{ marginTop: 12 }}>
              <button type="button" className="btn btn--primary" onClick={handleActivate}>
                <RefreshCw size={18} aria-hidden="true" />
                Try again
              </button>
              <a className="btn btn--secondary" href={`tel:${COMPANY.controlRoomPhone.replace(/\s/g, '')}`}>
                <Phone size={18} aria-hidden="true" />
                Call control room
              </a>
            </div>
            <div style={{ marginTop: 12 }}>
              <button type="button" className="btn btn--quiet" onClick={() => setPhase('idle')}>
                Back to panic button
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Emergency numbers — always available */}
      <section className="card" aria-label="Emergency numbers">
        <div className="card__title">Emergency numbers</div>
        <div className="stack-sm">
          {EMERGENCY_NUMBERS.map(({ label, number }) => (
            <a
              key={number}
              className="row-between"
              href={`tel:${number.replace(/\s/g, '')}`}
              style={{ minHeight: 48, textDecoration: 'none', color: 'inherit' }}
            >
              <span className="row" style={{ gap: 10 }}>
                <Phone size={18} aria-hidden="true" />
                <span>{label}</span>
              </span>
              <span style={{ fontWeight: 600 }} className="mono">{number}</span>
            </a>
          ))}
        </div>
      </section>

      {showManual && (
        <Modal
          title="Enter your address"
          onClose={() => setShowManual(false)}
          actions={(
            <>
              <button
                type="button"
                className="btn btn--primary btn--block"
                onClick={() => {
                  setManualAddress(manualDraft.trim());
                  setShowManual(false);
                  locate(manualDraft.trim());
                }}
              >
                Save address
              </button>
              <button type="button" className="btn btn--quiet btn--block" onClick={() => setShowManual(false)}>
                Cancel
              </button>
            </>
          )}
        >
          <p className="modal__body">
            Use this when GPS is unavailable or inaccurate. The address you enter is included in the alert
            so responders know where to go.
          </p>
          <div className="field">
            <label className="field__label" htmlFor="manual-address">Street address, suburb, city</label>
            <textarea
              id="manual-address"
              className="textarea"
              value={manualDraft}
              onChange={(e) => setManualDraft(e.target.value)}
              placeholder="e.g. 42 Marthinus Pretorius Street, Pretoria Central, 0002"
            />
          </div>
        </Modal>
      )}
    </div>
  );
}

function SendStep({ done, label }) {
  return (
    <div className={`send-step ${done ? 'send-step--done' : 'send-step--pending'}`}>
      {done ? <Check size={18} aria-hidden="true" /> : <span style={{ width: 18, textAlign: 'center' }}>—</span>}
      <span>{label}</span>
    </div>
  );
}
