/**
 * Profile screen — personal details, medical information (shared only with
 * responders), armed response contract and up to 3 emergency contacts.
 * Includes the POPIA consent record.
 */
import { useEffect, useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';

import { api } from '../lib/api.js';
import { COMPANY, POPIA_NOTICE } from '../lib/format.js';

const EMPTY_CONTACT = { name: '', phone: '', relationship: '' };

export function Profile() {
  const [profile, setProfile] = useState(null);
  const [contacts, setContacts] = useState([EMPTY_CONTACT]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await api.getProfile();
        if (!mounted) return;
        setProfile(data.profile);
        setContacts(data.contacts.length ? data.contacts : [EMPTY_CONTACT]);
      } catch (err) {
        if (mounted) setError(err.message || 'Unable to load profile.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  function setField(key, value) {
    setProfile((p) => ({ ...p, [key]: value }));
    setSaved(false);
  }

  function setContactField(index, key, value) {
    setContacts((list) => list.map((c, i) => (i === index ? { ...c, [key]: value } : c)));
    setSaved(false);
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const cleaned = contacts.filter((c) => c.name.trim() || c.phone.trim());
      const data = await api.saveProfile(profile, cleaned);
      setProfile(data.profile);
      setContacts(data.contacts.length ? data.contacts : [EMPTY_CONTACT]);
      setSaved(true);
    } catch (err) {
      setError(err.message || 'Unable to save the profile.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="page"><div className="empty-state">Loading profile…</div></div>;
  if (!profile) {
    return <div className="page"><div className="notice notice--error"><span className="notice__title">{error}</span></div></div>;
  }

  return (
    <form className="page" onSubmit={save}>
      <h1>Profile</h1>
      <p className="muted">
        This information is attached to every alert so responders can assist you effectively.
      </p>

      <section className="card">
        <div className="card__title">Personal details</div>
        <div className="stack">
          <div className="grid-2">
            <Field label="Name" value={profile.first_name} onChange={(v) => setField('first_name', v)} />
            <Field label="Surname" value={profile.surname} onChange={(v) => setField('surname', v)} />
          </div>
          <div className="grid-2">
            <Field label="ID number" value={profile.id_number} onChange={(v) => setField('id_number', v)} inputMode="numeric" />
            <Field label="Mobile number" value={profile.mobile} onChange={(v) => setField('mobile', v)} inputMode="tel" />
          </div>
          <Field label="Residential address" value={profile.address} onChange={(v) => setField('address', v)} textarea />
        </div>
      </section>

      <section className="card">
        <div className="card__title">Medical information (optional)</div>
        <div className="stack">
          <Field
            label="Medical conditions"
            value={profile.medical_conditions}
            onChange={(v) => setField('medical_conditions', v)}
            textarea
            hint="Shared only with dispatched responders and the control room."
          />
          <Field label="Allergies" value={profile.allergies} onChange={(v) => setField('allergies', v)} />
        </div>
      </section>

      <section className="card">
        <div className="card__title">Armed response account</div>
        <Field
          label="Contract / account number"
          value={profile.contract_number}
          onChange={(v) => setField('contract_number', v)}
          hint={`As issued by ${COMPANY.name}.`}
        />
      </section>

      <section className="card">
        <div className="row-between">
          <div className="card__title" style={{ marginBottom: 0 }}>Emergency contacts</div>
          <span className="small muted">{contacts.filter((c) => c.name || c.phone).length} of 3</span>
        </div>
        <div className="stack" style={{ marginTop: 12 }}>
          {contacts.map((contact, i) => (
            <div key={i} className="card card--flat" style={{ borderColor: 'var(--border)' }}>
              <div className="row-between" style={{ marginBottom: 8 }}>
                <strong className="small">Contact {i + 1}</strong>
                {contacts.length > 1 && (
                  <button
                    type="button"
                    className="btn btn--quiet"
                    style={{ minHeight: 40, padding: '0 12px' }}
                    onClick={() => setContacts((list) => list.filter((_, j) => j !== i))}
                    aria-label={`Remove contact ${i + 1}`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    Remove
                  </button>
                )}
              </div>
              <div className="stack-sm">
                <Field label="Full name" value={contact.name} onChange={(v) => setContactField(i, 'name', v)} />
                <div className="grid-2">
                  <Field label="Phone" value={contact.phone} onChange={(v) => setContactField(i, 'phone', v)} inputMode="tel" />
                  <Field label="Relationship" value={contact.relationship} onChange={(v) => setContactField(i, 'relationship', v)} />
                </div>
              </div>
            </div>
          ))}

          {contacts.length < 3 && (
            <button
              type="button"
              className="btn btn--quiet"
              onClick={() => setContacts((list) => [...list, { ...EMPTY_CONTACT }])}
            >
              <Plus size={18} aria-hidden="true" />
              Add contact
            </button>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card__title">Consent (POPIA)</div>
        <div className="checkbox-row">
          <input
            id="popia-consent"
            type="checkbox"
            checked={Boolean(profile.popia_consent)}
            onChange={(e) => setField('popia_consent', e.target.checked ? 1 : 0)}
          />
          <label htmlFor="popia-consent">
            I consent to {COMPANY.name} processing my personal information, including location and
            medical information, for the purpose of providing armed response and emergency assistance
            as described in the privacy notice.
          </label>
        </div>
        <details style={{ marginTop: 8 }}>
          <summary className="small" style={{ cursor: 'pointer', fontWeight: 600 }}>Read the privacy notice</summary>
          <p className="small muted" style={{ marginTop: 8, whiteSpace: 'pre-line' }}>{POPIA_NOTICE}</p>
        </details>
      </section>

      {error && <div className="notice notice--error" role="alert"><span className="notice__title">{error}</span></div>}
      {saved && (
        <div className="notice notice--navy" role="status">
          <Check size={22} className="notice__icon" aria-hidden="true" />
          <div>Profile saved.</div>
        </div>
      )}

      <button type="submit" className="btn btn--primary btn--block" disabled={saving}>
        {saving ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  );
}

function Field({ label, value, onChange, textarea, hint, inputMode }) {
  const id = `f-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>{label}</label>
      {textarea ? (
        <textarea
          id={id}
          className="textarea"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={id}
          className="input"
          type="text"
          inputMode={inputMode}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {hint ? <span className="field__hint">{hint}</span> : null}
    </div>
  );
}
