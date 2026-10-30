/**
 * Modal + PIN entry keypad.
 *
 * The PIN guards against misuse when cancelling an alert ("false alarm").
 * Large keys keep the pad usable under stress (min. 56px targets).
 */
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export function Modal({ title, onClose, children, actions, dismissable = true }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && dismissable) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, dismissable]);

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && dismissable) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="row-between">
          <h2 className="modal__title">{title}</h2>
          {dismissable && (
            <button
              type="button"
              className="btn btn--quiet"
              style={{ minWidth: 44, minHeight: 44, padding: 0 }}
              onClick={onClose}
              aria-label="Close"
            >
              <X size={20} aria-hidden="true" />
            </button>
          )}
        </div>
        {children}
        {actions ? <div className="modal__actions">{actions}</div> : null}
      </div>
    </div>
  );
}

export function PinModal({ title = 'Enter PIN', body, onCancel, onVerify }) {
  const [digits, setDigits] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(pin) {
    setBusy(true);
    setError('');
    try {
      await onVerify(pin);
    } catch (err) {
      setError(err.message || 'Incorrect PIN.');
      setDigits('');
    } finally {
      setBusy(false);
    }
  }

  function press(d) {
    if (busy) return;
    const next = (digits + d).slice(0, 4);
    setDigits(next);
    if (next.length === 4) submit(next);
  }

  return (
    <Modal title={title} onClose={onCancel} dismissable={!busy}>
      {body ? <p className="modal__body">{body}</p> : null}

      <div className="pin-dots" aria-label={`${digits.length} of 4 digits entered`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`pin-dot ${i < digits.length ? 'pin-dot--filled' : ''}`} />
        ))}
      </div>

      {error ? (
        <p className="notice notice--error" role="alert">
          <span className="notice__title">{error}</span>
        </p>
      ) : null}

      <div className="pin-pad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" className="pin-key" onClick={() => press(d)} disabled={busy}>
            {d}
          </button>
        ))}
        <button
          type="button"
          className="pin-key pin-key--action"
          onClick={() => setDigits('')}
          disabled={busy}
        >
          Clear
        </button>
        <button type="button" className="pin-key" onClick={() => press('0')} disabled={busy}>
          0
        </button>
        <button type="button" className="pin-key pin-key--action" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}
