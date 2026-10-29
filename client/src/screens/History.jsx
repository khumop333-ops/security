/**
 * History screen — a clean list of past alerts with date, time and outcome.
 * Rows link through to the full status/audit detail for each alert.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Clock } from 'lucide-react';

import { api } from '../lib/api.js';
import {
  formatDate, formatTime, STATUS_LABELS, statusBadgeVariant
} from '../lib/format.js';

export function History() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { alerts: list } = await api.listAlerts();
        if (mounted) setAlerts(list);
      } catch (err) {
        if (mounted) setError(err.message || 'Unable to load history.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Group by calendar day for a scannable list.
  const groups = [];
  for (const alert of alerts) {
    const day = formatDate(alert.created_at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(alert);
    else groups.push({ day, items: [alert] });
  }

  return (
    <div className="page">
      <h1>Alert history</h1>
      <p className="muted">Past alerts with date, time and resolution status.</p>

      {loading && <div className="empty-state">Loading history…</div>}
      {error && <div className="notice notice--error" role="alert"><span className="notice__title">{error}</span></div>}

      {!loading && !error && alerts.length === 0 && (
        <div className="empty-state">
          <Clock size={28} aria-hidden="true" style={{ marginBottom: 8 }} />
          <div>No alerts have been recorded.</div>
        </div>
      )}

      {groups.map((group) => (
        <section key={group.day} className="stack-sm">
          <div className="section-heading">{group.day}</div>
          <div className="history-list">
            {group.items.map((alert) => (
              <Link key={alert.id} to={`/status/${alert.id}`} className="history-item">
                <div className="history-item__top">
                  <span className="history-item__code mono">{alert.code}</span>
                  <span className={`badge badge--${statusBadgeVariant(alert.status)}`}>
                    {STATUS_LABELS[alert.status]}
                  </span>
                </div>
                <div className="row-between">
                  <span style={{ fontWeight: 600 }}>
                    {formatTime(alert.created_at)}
                    <span className="muted" style={{ fontWeight: 400 }}>
                      {' · '}{alert.type === 'test' ? 'Test alert' : 'Panic alert'}
                    </span>
                  </span>
                  <ChevronRight size={18} aria-hidden="true" className="muted" />
                </div>
                <div className="history-item__addr">{alert.address || 'No address recorded'}</div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
