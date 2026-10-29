/**
 * Hold-to-activate panic button (3 seconds).
 *
 * Accidental trigger protection: the alert only fires after a deliberate,
 * continuous 3-second press. Releasing early — or dragging off the button —
 * cancels cleanly. The ring around the button shows hold progress; it is a
 * functional indicator, not decoration.
 */
import { useEffect, useRef, useState } from 'react';
import { ShieldAlert } from 'lucide-react';

const HOLD_MS = 3000;

export function PanicButton({ disabled, onActivate }) {
  const [holding, setHolding] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const timerRef = useRef(null);
  const tickRef = useRef(null);
  const holdingRef = useRef(false);

  // Clear all timers on unmount.
  useEffect(() => () => {
    clearTimeout(timerRef.current);
    clearInterval(tickRef.current);
  }, []);

  function startHold() {
    if (disabled || holdingRef.current) return;
    holdingRef.current = true;
    setHolding(true);
    setSecondsLeft(3);

    tickRef.current = setInterval(() => {
      setSecondsLeft((s) => (s && s > 1 ? s - 1 : 1));
    }, 1000);

    timerRef.current = setTimeout(() => {
      cancelHoldTimers();
      holdingRef.current = false;
      setHolding(false);
      setSecondsLeft(null);
      onActivate();
    }, HOLD_MS);
  }

  function cancelHoldTimers() {
    clearTimeout(timerRef.current);
    clearInterval(tickRef.current);
    timerRef.current = null;
    tickRef.current = null;
  }

  function cancelHold() {
    if (!holdingRef.current) return;
    cancelHoldTimers();
    holdingRef.current = false;
    setHolding(false);
    setSecondsLeft(null);
  }

  return (
    <div className="panic-zone">
      <div className={`panic-wrap ${holding ? 'panic-wrap--holding' : ''}`}>
        <svg className="panic-ring" viewBox="0 0 264 264" aria-hidden="true">
          <circle className="panic-ring__track" cx="132" cy="132" r="124" />
          <circle className="panic-ring__progress" cx="132" cy="132" r="124" />
        </svg>

        <button
          type="button"
          className="panic-btn"
          disabled={disabled}
          aria-label="Panic button. Press and hold for three seconds to alert security."
          onPointerDown={(e) => {
            e.preventDefault();
            startHold();
          }}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
          onKeyDown={(e) => {
            // Keyboard accessibility: hold Enter/Space via key repeat is unreliable,
            // so key activation triggers the same deliberate countdown the pointer uses.
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              startHold();
            }
          }}
          onKeyUp={cancelHold}
          onBlur={cancelHold}
        >
          <ShieldAlert size={44} strokeWidth={1.75} aria-hidden="true" />
          <span className="panic-btn__label">PANIC</span>
          <span className="panic-btn__hint">
            {holding
              ? `Keep holding — ${secondsLeft}s. Release to cancel.`
              : 'Press and hold to alert security'}
          </span>
        </button>
      </div>

      <p className="panic-instruction">
        {holding
          ? 'Keep holding for three seconds. Your location and profile are sent to the control room.'
          : 'In an emergency, press and hold the button for three seconds. Release at any time to cancel.'}
      </p>
    </div>
  );
}
