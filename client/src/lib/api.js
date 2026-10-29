/**
 * Thin fetch wrapper for the panic-button API.
 * All API paths are relative so the app works behind any host/proxy.
 */

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    /* non-JSON response — handled below */
  }

  if (!res.ok) {
    const message = payload?.error?.message || `Request failed (${res.status}).`;
    const error = new Error(message);
    error.code = payload?.error?.code || 'REQUEST_FAILED';
    error.status = res.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export const api = {
  /* profile & settings */
  getProfile: () => request('/api/profile'),
  saveProfile: (profile, contacts) => request('/api/profile', { method: 'PUT', body: { profile, contacts } }),
  verifyPin: (pin) => request('/api/pin/verify', { method: 'POST', body: { pin } }),
  changePin: (currentPin, newPin) => request('/api/pin', { method: 'PUT', body: { currentPin, newPin } }),
  submitPrivacyRequest: (requestType, detail) =>
    request('/api/privacy/requests', { method: 'POST', body: { requestType, detail } }),

  /* alerts */
  createAlert: (alert) => request('/api/alerts', { method: 'POST', body: alert }),
  getActiveAlert: () => request('/api/alerts/active'),
  getAlert: (id) => request(`/api/alerts/${id}`),
  listAlerts: () => request('/api/alerts'),
  cancelAlert: (id, pin, reason) =>
    request(`/api/alerts/${id}/cancel`, { method: 'POST', body: { pin, reason } }),

  /* dispatch console */
  dispatchList: (filter) => request(`/api/dispatch/alerts${filter ? `?filter=${filter}` : ''}`),
  dispatchSetStatus: (id, body) => request(`/api/dispatch/alerts/${id}/status`, { method: 'POST', body }),
  dispatchSimulate: (operatorName) =>
    request('/api/dispatch/simulate', { method: 'POST', body: { operatorName } })
};
