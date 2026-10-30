/**
 * Live updates: WebSocket first, automatic polling fallback.
 *
 * Some hosting proxies do not forward WebSocket upgrades. If the socket is
 * not open shortly after connecting (or drops), we poll the REST API and emit
 * synthetic `refresh` events so screens stay current either way.
 */
export function createLiveClient({ onMessage, onStatus }) {
  let socket = null;
  let pollTimer = null;
  let reconnectTimer = null;
  let openFallbackTimer = null;
  let closed = false;
  let attempts = 0;

  function emitStatus(status) {
    if (typeof onStatus === 'function') onStatus(status);
  }

  function emit(message) {
    if (typeof onMessage === 'function') onMessage(message);
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(() => emit({ type: 'refresh', serverTime: new Date().toISOString() }), 5000);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function connect() {
    if (closed) return;
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${window.location.host}/ws`;

    try {
      socket = new WebSocket(url);
    } catch {
      emitStatus('polling');
      startPolling();
      return;
    }

    // If the socket does not open quickly, assume the proxy blocks upgrades
    // and keep data fresh by polling instead.
    openFallbackTimer = setTimeout(() => {
      if (socket && socket.readyState !== WebSocket.OPEN) {
        emitStatus('polling');
        startPolling();
      }
    }, 3000);

    socket.onopen = () => {
      clearTimeout(openFallbackTimer);
      attempts = 0;
      stopPolling();
      emitStatus('live');
    };

    socket.onmessage = (event) => {
      try {
        emit(JSON.parse(event.data));
      } catch {
        /* ignore malformed frames */
      }
    };

    socket.onclose = () => {
      clearTimeout(openFallbackTimer);
      if (closed) return;
      // Polling keeps data fresh regardless; report that honestly rather than
      // a permanent "reconnecting" state (e.g. on Vercel where WS is unavailable).
      startPolling();
      emitStatus('polling');
      attempts += 1;
      // A few background reconnect attempts; polling carries the load after that.
      if (attempts <= 5) {
        const delay = Math.min(1000 * 2 ** attempts, 15000);
        reconnectTimer = setTimeout(connect, delay);
      }
    };

    socket.onerror = () => {
      try {
        socket.close();
      } catch {
        /* already closed */
      }
    };
  }

  connect();

  return function unsubscribe() {
    closed = true;
    clearTimeout(reconnectTimer);
    clearTimeout(openFallbackTimer);
    stopPolling();
    try {
      if (socket) socket.close();
    } catch {
      /* noop */
    }
  };
}
