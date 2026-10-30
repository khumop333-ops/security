/**
 * Control-room dispatch console.
 *
 * Desktop-first layout: alert queue on the left, map + alert detail on the
 * right. Operators advance the response (en route → arrived → resolved) and
 * the client apps update live over WebSocket.
 *
 * NOTE: no operator authentication in the prototype — see README roadmap.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import {
  AlertTriangle, Check, Crosshair, MapPin, Phone, PlusCircle, Radio
} from 'lucide-react';

import { api } from '../lib/api.js';
import { createLiveClient } from '../lib/live.js';
import {
  COMPANY, formatDateTime, isActiveStatus, STATUS_LABELS, statusBadgeVariant
} from '../lib/format.js';

/* Pretoria city centre — the service area of the demo company. */
const PRETORIA = [-25.7479, 28.1885];

function markerIcon(alert) {
  let cls = 'marker-pin';
  if (alert.status === 'resolved' || alert.status === 'test_complete') cls += ' marker-pin--resolved';
  else if (alert.status === 'cancelled') cls += ' marker-pin--muted';
  return L.divIcon({
    className: '',
    html: `<div class="${cls}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4.5 8-11V5l-8-3-8 3v6c0 6.5 8 11 8 11z"/></svg></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 30],
    popupAnchor: [0, -28]
  });
}

/** Fly the map to the selected alert when the operator selects it. */
function FlyToAlert({ alert }) {
  const map = useMap();
  useEffect(() => {
    if (alert && alert.lat != null) {
      map.flyTo([alert.lat, alert.lng], 15, { duration: 0.6 });
    }
  }, [alert, map]);
  return null;
}

export function Dispatch() {
  const [alerts, setAlerts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState('active');
  const [operator, setOperator] = useState(() => localStorage.getItem('sentinel.operator') || '');
  const [liveStatus, setLiveStatus] = useState('connecting');
  const [mapReady, setMapReady] = useState(true);

  const [etaInput, setEtaInput] = useState('8');
  const [unitInput, setUnitInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [busy, setBusy] = useState(false);

  const operatorRef = useRef(operator);
  useEffect(() => { operatorRef.current = operator; }, [operator]);

  const loadList = useCallback(async () => {
    try {
      const { alerts: list } = await api.dispatchList(filter === 'all' ? undefined : filter);
      setAlerts(list);
    } catch {
      /* keep the last good list */
    }
  }, [filter]);

  const loadDetail = useCallback(async (id) => {
    if (!id) return;
    try {
      const data = await api.getAlert(id);
      setEvents(data.events || []);
    } catch {
      /* detail stays on last values */
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { loadDetail(selectedId); }, [loadDetail, selectedId]);

  useEffect(() => {
    const unsubscribe = createLiveClient({
      onMessage: (msg) => {
        if (msg.type === 'refresh' || msg.type === 'alert.created' || msg.type === 'alert.updated') {
          loadList();
          if (msg.type === 'alert.created' && isActiveStatus(msg.alert?.status)) {
            setSelectedId(msg.alert.id);
          }
          if (selectedId) loadDetail(selectedId);
        }
      },
      onStatus: setLiveStatus
    });
    return unsubscribe;
  }, [loadList, loadDetail, selectedId]);

  const selected = useMemo(
    () => alerts.find((a) => a.id === selectedId) || null,
    [alerts, selectedId]
  );

  // Keep detail pane in sync when the list refreshes the selected alert.
  useEffect(() => {
    if (selected) loadDetail(selected.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.updated_at]);

  async function advance(status, extra = {}) {
    if (!selected) return;
    setBusy(true);
    try {
      await api.dispatchSetStatus(selected.id, {
        status,
        operatorName: operatorRef.current,
        etaMinutes: extra.eta ? Number(etaInput) : undefined,
        responderName: extra.unit ? unitInput.split('—')[0]?.trim() : undefined,
        responderUnit: extra.unit ? unitInput : undefined,
        note: noteInput || undefined
      });
      setNoteInput('');
      await loadList();
      await loadDetail(selected.id);
    } catch (err) {
      alert(err.message || 'Unable to update the alert.');
    } finally {
      setBusy(false);
    }
  }

  async function simulate() {
    setBusy(true);
    try {
      const { alert } = await api.dispatchSimulate(operatorRef.current);
      setFilter('active');
      setSelectedId(alert.id);
      await loadList();
    } catch (err) {
      alert(err.message || 'Unable to simulate an alert.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dispatch">
      <header className="dispatch-header">
        <div>
          <div className="dispatch-header__title">{COMPANY.name} — Dispatch Console</div>
          <div className="dispatch-header__sub">Control room · Pretoria</div>
        </div>
        <div className="dispatch-header__spacer" />
        <div className="dispatch-operator">
          <span className={`live-dot ${liveStatus === 'live' ? '' : 'live-dot--down'}`} aria-hidden="true" />
          <span>{liveStatus === 'live' ? 'Live' : liveStatus === 'polling' ? 'Polling' : 'Connecting'}</span>
          <input
            value={operator}
            onChange={(e) => {
              setOperator(e.target.value);
              localStorage.setItem('sentinel.operator', e.target.value);
            }}
            placeholder="Operator name"
            aria-label="Operator name"
          />
        </div>
        <Link to="/" className="btn btn--on-navy" style={{ minHeight: 40 }}>
          Client app
        </Link>
      </header>

      <div className="dispatch-body">
        {/* Queue */}
        <div className="dispatch-queue">
          <div className="dispatch-filters" role="group" aria-label="Alert filters">
            {[
              { key: 'active', label: 'Active' },
              { key: 'test', label: 'Tests' },
              { key: 'all', label: 'All' }
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={`chip ${filter === key ? 'chip--active' : ''}`}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
            <button type="button" className="chip" onClick={simulate} disabled={busy} style={{ marginLeft: 'auto' }}>
              <PlusCircle size={15} aria-hidden="true" style={{ marginRight: 4, verticalAlign: -2 }} />
              Simulate alert
            </button>
          </div>

          {alerts.length === 0 && (
            <div className="empty-state card">
              No {filter === 'all' ? '' : filter} alerts. Incoming panic alerts appear here instantly.
            </div>
          )}

          {alerts.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`queue-item ${a.id === selectedId ? 'queue-item--selected' : ''}`}
              onClick={() => setSelectedId(a.id)}
            >
              <div className="queue-item__top">
                <span className="queue-item__name">{a.user_name || 'Unknown client'}</span>
                <span className={`badge badge--${statusBadgeVariant(a.status)}`}>{STATUS_LABELS[a.status]}</span>
              </div>
              <div className="queue-item__meta mono">{a.code} · {formatDateTime(a.created_at)}</div>
              <div className="queue-item__meta">
                {a.type === 'test' ? 'Test — no responders' : a.address || 'No address'}
              </div>
            </button>
          ))}
        </div>

        {/* Detail + map */}
        <div className="dispatch-detail">
          {!selected ? (
            <div className="card empty-state">
              <Crosshair size={28} aria-hidden="true" style={{ marginBottom: 8 }} />
              <div>Select an alert from the queue to see the client location and details.</div>
            </div>
          ) : (
            <>
              <div className="map-panel">
                {mapReady ? (
                  <MapContainer
                    center={selected.lat != null ? [selected.lat, selected.lng] : PRETORIA}
                    zoom={13}
                    scrollWheelZoom
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                      eventHandlers={{ tileerror: () => setMapReady(false) }}
                    />
                    <FlyToAlert alert={selected} />
                    {alerts.filter((a) => a.lat != null).map((a) => (
                      <Marker key={a.id} position={[a.lat, a.lng]} icon={markerIcon(a)}>
                        <Popup>
                          <strong>{a.user_name}</strong><br />
                          {a.code} — {STATUS_LABELS[a.status]}
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                ) : (
                  <div className="map-fallback">Map tiles unavailable. Coordinates: {selected.lat}, {selected.lng}</div>
                )}
              </div>

              <section className="card">
                <div className="row-between">
                  <div>
                    <div className="card__title">{selected.type === 'test' ? 'Test alert' : 'Panic alert'} {selected.code}</div>
                    <h2>{selected.user_name}</h2>
                    <div className="small muted">{formatDateTime(selected.created_at)}</div>
                  </div>
                  <span className={`badge badge--${statusBadgeVariant(selected.status)}`}>
                    {STATUS_LABELS[selected.status]}
                  </span>
                </div>

                <hr className="divider" />

                <div className="data-list">
                  <Row k="ID number" v={selected.user_id_number || '—'} />
                  <Row k="Mobile" v={selected.user_mobile || '—'} />
                  <Row k="Contract" v={selected.contract_number || '—'} />
                  <Row k="Location" v={selected.address || `${selected.lat}, ${selected.lng}`} />
                  {selected.lat != null && (
                    <Row k="Coordinates" v={`${selected.lat.toFixed(5)}, ${selected.lng.toFixed(5)} (±${Math.round(selected.accuracy || 0)} m)`} />
                  )}
                  <Row k="Medical" v={selected.medical_summary || 'None recorded'} />
                  {selected.eta_minutes != null && <Row k="ETA given" v={`${selected.eta_minutes} minutes`} />}
                  {selected.responder_unit && (
                    <Row k="Responder" v={`${selected.responder_unit}${selected.responder_name ? ` — ${selected.responder_name}` : ''}`} />
                  )}
                </div>
              </section>

              {/* Operator actions */}
              {isActiveStatus(selected.status) && (
                <section className="card">
                  <div className="card__title">Response actions</div>
                  <div className="stack" style={{ marginBottom: 12 }}>
                    <div className="grid-2">
                      <div className="field">
                        <label className="field__label" htmlFor="eta">ETA (minutes)</label>
                        <input
                          id="eta"
                          className="input"
                          type="number"
                          min="1"
                          max="120"
                          value={etaInput}
                          onChange={(e) => setEtaInput(e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label className="field__label" htmlFor="unit">Responder name / unit</label>
                        <input
                          id="unit"
                          className="input"
                          value={unitInput}
                          onChange={(e) => setUnitInput(e.target.value)}
                          placeholder="e.g. Unit R-14 — J. Nel"
                        />
                      </div>
                    </div>
                    <div className="field">
                      <label className="field__label" htmlFor="note">Note to client / audit log</label>
                      <input
                        id="note"
                        className="input"
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                  </div>

                  <div className="dispatch-actions">
                    {selected.status === 'dispatch_notified' && (
                      <button
                        type="button"
                        className="btn btn--primary"
                        disabled={busy}
                        onClick={() => advance('responder_en_route', { eta: true, unit: true })}
                      >
                        <Radio size={18} aria-hidden="true" />
                        Mark responder en route
                      </button>
                    )}
                    {selected.status === 'responder_en_route' && (
                      <button
                        type="button"
                        className="btn btn--primary"
                        disabled={busy}
                        onClick={() => advance('responder_arrived', { unit: true })}
                      >
                        <MapPin size={18} aria-hidden="true" />
                        Mark responder arrived
                      </button>
                    )}
                    {(selected.status === 'responder_arrived' || selected.status === 'responder_en_route' || selected.status === 'dispatch_notified') && (
                      <button
                        type="button"
                        className="btn btn--secondary"
                        disabled={busy}
                        onClick={() => advance('resolved')}
                      >
                        <Check size={18} aria-hidden="true" />
                        Resolve alert
                      </button>
                    )}
                    <a className="btn btn--quiet" href={`tel:${(selected.user_mobile || '').replace(/\s/g, '')}`}>
                      <Phone size={18} aria-hidden="true" />
                      Call client
                    </a>
                  </div>
                </section>
              )}

              {/* Audit timeline */}
              <section className="card">
                <div className="card__title">Event log</div>
                <div className="stack-sm">
                  {events.map((e) => (
                    <div key={e.id} className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
                      <AlertTriangle
                        size={16}
                        aria-hidden="true"
                        style={{ marginTop: 3, flexShrink: 0, color: 'var(--text-muted)' }}
                      />
                      <div>
                        <div className="small" style={{ fontWeight: 600 }}>
                          {STATUS_LABELS[e.to_status] || e.to_status}
                          <span className="muted" style={{ fontWeight: 400 }}>
                            {' · '}{formatDateTime(e.created_at)} · {e.actor_name || e.actor}
                          </span>
                        </div>
                        {e.note && <div className="small muted">{e.note}</div>}
                      </div>
                    </div>
                  ))}
                  {events.length === 0 && <div className="small muted">No events recorded.</div>}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="data-list__row">
      <span className="data-list__key">{k}</span>
      <span className="data-list__val">{v}</span>
    </div>
  );
}
