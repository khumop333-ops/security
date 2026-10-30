/**
 * Settings — PIN management, notification preferences, test alert and
 * POPIA data-subject requests.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, KeyRound, ShieldCheck, ShieldQuestion } from 'lucide-react';

import { Modal } from '../components/PinModal.jsx';
import { api } from '../lib/api.js';
import { resolvePosition } from '../lib/geo.js';
import { COMPANY, EMERGENCY_NUMBERS, POPIA_NOTICE } from '../lib/format.js';

export function Settings() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [pinForm, setPinForm] = useState({ current: '', next: '', confirm: '' });
  const [pinMsg, setPinMsg] = useState(null);
  const [notifMsg, setNotifMsg] = useState(false);

  const [showTest, setShowTest] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [privacyMsg, setPrivacyMsg] = useState('');

  useEffect(() => {
    api.getProfile().then((data) => setProfile(data.profile)).catch(() => {});
  }, []);

  async function changePin(e) {
    e.preventDefault();
    setPinMsg(null);
    if (pinForm.next !== pinForm.confirm) {
      setPinMsg({ ok: false, text: 'The new PIN and its confirmation do not match.' });
      return;
    }
    try {
      await api.changePin(pinForm.current, pinForm.next);
      setPinForm({ current: '', next: '', confirm: '' });
      setPinMsg({ ok: true, text: 'PIN changed successfully.' });
    } catch (err) {
      setPinMsg({ ok: false, text: err.message || 'Unable to change the PIN.' });
    }
  }

  async function saveNotification(key, value) {
    const next = { ...profile, [key]: value ? 1 : 0 };
    setProfile(next);
    try {
      const data = await api.saveProfile(next, null);
      setProfile(data.profile);
      setNotifMsg(true);
      setTimeout(() => setNotifMsg(false), 2500);
    } catch {
      setProfile(profile); // revert on failure
    }
  }

  async function sendTest() {
    setTestBusy(true);
    try {
      const position = await resolvePosition({ manualAddress: '' });
      const { alert } = await api.createAlert({
        type: 'test',
        lat: position.lat,
        lng: position.lng,
        accuracy: position.accuracy,
        address: position.address,
        addressSource: position.addressSource
      });
      setShowTest(false);
      navigate(`/status/${alert.id}`);
    } catch (err) {
      setTestBusy(false);
      alert(err.message || 'The test alert could not be sent.');
    }
  }

  async function submitPrivacyRequest(type, label) {
    try {
      const res = await api.submitPrivacyRequest(type, `Requested from the app settings screen.`);
      setPrivacyMsg(`${label} request submitted. ${res.message}`);
    } catch (err) {
      setPrivacyMsg(err.message || 'Unable to submit the request.');
    }
  }

  if (!profile) return <div className="page"><div className="empty-state">Loading settings…</div></div>;

  return (
    <div className="page">
      <h1>Settings</h1>

      {/* PIN */}
      <section className="card">
        <div className="card__title">Security</div>
        <form className="stack" onSubmit={changePin}>
          <div className="field">
            <label className="field__label" htmlFor="cur-pin">Current PIN</label>
            <input
              id="cur-pin"
              className="input"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              maxLength={6}
              value={pinForm.current}
              onChange={(e) => setPinForm({ ...pinForm, current: e.target.value.replace(/\D/g, '') })}
            />
          </div>
          <div className="grid-2">
            <div className="field">
              <label className="field__label" htmlFor="new-pin">New PIN</label>
              <input
                id="new-pin"
                className="input"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                value={pinForm.next}
                onChange={(e) => setPinForm({ ...pinForm, next: e.target.value.replace(/\D/g, '') })}
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="conf-pin">Confirm new PIN</label>
              <input
                id="conf-pin"
                className="input"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                value={pinForm.confirm}
                onChange={(e) => setPinForm({ ...pinForm, confirm: e.target.value.replace(/\D/g, '') })}
              />
            </div>
          </div>
          <p className="field__hint">
            The PIN is required to cancel an alert. Use 4 to 6 digits. Do not share it.
          </p>
          {pinMsg && (
            <div className={`notice ${pinMsg.ok ? 'notice--navy' : 'notice--error'}`} role="status">
              {pinMsg.ok ? <Check size={20} className="notice__icon" aria-hidden="true" /> : <KeyRound size={20} className="notice__icon" aria-hidden="true" />}
              <div>{pinMsg.text}</div>
            </div>
          )}
          <button type="submit" className="btn btn--primary">
            <KeyRound size={18} aria-hidden="true" />
            Change PIN
          </button>
        </form>
      </section>

      {/* Notifications */}
      <section className="card">
        <div className="card__title">Notifications</div>
        <SwitchRow
          label="Notify emergency contacts by SMS"
          desc="Contacts receive an SMS with your alert details and location when you press PANIC."
          checked={Boolean(profile.notify_sms)}
          onChange={(v) => saveNotification('notify_sms', v)}
        />
        <SwitchRow
          label="Notify emergency contacts on WhatsApp"
          desc="Send the same notification as a WhatsApp message instead of SMS."
          checked={Boolean(profile.notify_whatsapp)}
          onChange={(v) => saveNotification('notify_whatsapp', v)}
        />
        <SwitchRow
          label="Status update notifications"
          desc="Be notified when the responder status changes (en route, arrived, resolved)."
          checked={Boolean(profile.notify_status_updates)}
          onChange={(v) => saveNotification('notify_status_updates', v)}
        />
        {notifMsg && <div className="small muted" style={{ marginTop: 8 }}>Preferences saved.</div>}
      </section>

      {/* Test alert */}
      <section className="card">
        <div className="card__title">Testing</div>
        <p className="small muted" style={{ marginBottom: 12 }}>
          A test alert confirms that your phone can reach the dispatch system. It is recorded in your
          history and shown to the control room as a test — no responders are dispatched.
        </p>
        <button type="button" className="btn btn--secondary" onClick={() => setShowTest(true)}>
          <ShieldCheck size={18} aria-hidden="true" />
          Send test alert
        </button>
      </section>

      {/* Privacy / POPIA */}
      <section className="card">
        <div className="card__title">Privacy (POPIA)</div>
        <p className="small muted" style={{ whiteSpace: 'pre-line' }}>{POPIA_NOTICE}</p>
        <div className="stack-sm" style={{ marginTop: 12 }}>
          <button type="button" className="btn btn--quiet" onClick={() => submitPrivacyRequest('access', 'Access')}>
            Request access to my information
          </button>
          <button type="button" className="btn btn--quiet" onClick={() => submitPrivacyRequest('correction', 'Correction')}>
            Request correction of my information
          </button>
          <button type="button" className="btn btn--quiet" onClick={() => submitPrivacyRequest('deletion', 'Deletion')}>
            Request deletion of my information
          </button>
        </div>
        {privacyMsg && (
          <div className="notice notice--navy" role="status" style={{ marginTop: 12 }}>
            <ShieldQuestion size={20} className="notice__icon" aria-hidden="true" />
            <div>{privacyMsg}</div>
          </div>
        )}
      </section>

      {/* About */}
      <section className="card">
        <div className="card__title">About</div>
        <div className="data-list">
          <DataRow k="Company" v={COMPANY.name} />
          <DataRow k="Control room" v={COMPANY.controlRoomPhone} />
          <DataRow k="App version" v="1.0.0 (prototype)" />
        </div>
        <hr className="divider" />
        <div className="stack-sm">
          {EMERGENCY_NUMBERS.map(({ label, number }) => (
            <DataRow key={number} k={label} v={number} />
          ))}
        </div>
      </section>

      {showTest && (
        <Modal
          title="Send a test alert?"
          onClose={() => setShowTest(false)}
          actions={(
            <>
              <button type="button" className="btn btn--primary btn--block" onClick={sendTest} disabled={testBusy}>
                {testBusy ? 'Sending test…' : 'Send test alert'}
              </button>
              <button type="button" className="btn btn--quiet btn--block" onClick={() => setShowTest(false)} disabled={testBusy}>
                Cancel
              </button>
            </>
          )}
        >
          <p className="modal__body">
            The control room will receive a test signal with your current location. No responders will be
            dispatched. Use this to confirm your connection before an emergency.
          </p>
        </Modal>
      )}
    </div>
  );
}

function SwitchRow({ label, desc, checked, onChange }) {
  return (
    <div className="switch-row">
      <div>
        <div className="switch-row__label">{label}</div>
        <div className="switch-row__desc">{desc}</div>
      </div>
      <label className="switch">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
        <span className="switch__track" />
      </label>
    </div>
  );
}

function DataRow({ k, v }) {
  return (
    <div className="data-list__row">
      <span className="data-list__key">{k}</span>
      <span className="data-list__val">{v}</span>
    </div>
  );
}
