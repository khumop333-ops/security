/**
 * Geolocation helpers with graceful degradation:
 *   1. High-accuracy GPS fix (best effort, 8s timeout).
 *   2. Last known good fix (persisted in localStorage) if GPS is unavailable
 *      or the user denies permission — flagged as "last_known" so dispatch
 *      can see the provenance of the coordinates.
 *   3. Manual address entry is always available as a fallback in the UI.
 *
 * Reverse geocoding uses the browser-side Nominatim endpoint. If it is
 * unreachable the app simply shows coordinates and the manual address field.
 */
const LAST_FIX_KEY = 'sentinel.lastFix';

export function getLastKnownFix() {
  try {
    const raw = localStorage.getItem(LAST_FIX_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveFix(fix) {
  try {
    localStorage.setItem(LAST_FIX_KEY, JSON.stringify({ ...fix, savedAt: new Date().toISOString() }));
  } catch {
    /* storage may be unavailable in private mode */
  }
}

/**
 * Resolve the current position.
 * @returns {Promise<{lat, lng, accuracy, source: 'gps'|'last_known', address: string, addressSource: string}>}
 */
export async function resolvePosition({ manualAddress } = {}) {
  let fix = null;

  try {
    fix = await new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error('Geolocation is not supported by this browser.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 }
      );
    });
    saveFix(fix);
  } catch {
    fix = getLastKnownFix();
    if (fix) {
      return {
        lat: fix.lat,
        lng: fix.lng,
        accuracy: fix.accuracy ?? null,
        source: 'last_known',
        address: manualAddress || fix.address || '',
        addressSource: manualAddress ? 'manual' : (fix.address ? 'last_known' : 'manual')
      };
    }
    // No GPS and no last-known fix: manual address only.
    return {
      lat: null,
      lng: null,
      accuracy: null,
      source: 'last_known',
      address: manualAddress || '',
      addressSource: 'manual'
    };
  }

  const address = manualAddress || (await reverseGeocode(fix.lat, fix.lng)) || '';
  return {
    ...fix,
    source: 'gps',
    address,
    addressSource: manualAddress ? 'manual' : (address ? 'gps' : 'manual')
  };
}

/** Best-effort reverse geocoding. Returns '' when offline or rate-limited. */
export async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=17&addressdetails=1`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return '';
    const data = await res.json();
    return data?.display_name ? String(data.display_name) : '';
  } catch {
    return '';
  }
}

/** Human-readable summary of a fix for the location confirmation strip. */
export function describeFix(fix) {
  if (!fix) return { title: 'Location not available', detail: 'Enter your address manually below.' };
  if (fix.source === 'gps') {
    return {
      title: 'Location confirmed',
      detail: fix.address || `Coordinates ${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)}`
    };
  }
  return {
    title: 'Using last known location',
    detail: fix.address || (fix.lat != null ? `Coordinates ${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)}` : 'No coordinates stored')
  };
}

/** Open the coordinates in the device's preferred map application. */
export function mapsLink(lat, lng) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}
