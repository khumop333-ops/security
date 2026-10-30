/**
 * Presentation helpers: status labels, dates (South African format) and
 * shared copy constants.
 */

export const STATUS_LABELS = {
  dispatch_notified: 'Dispatch Notified',
  responder_en_route: 'Responder En Route',
  responder_arrived: 'Responder Arrived',
  resolved: 'Resolved',
  cancelled: 'Cancelled',
  test_complete: 'Test Complete'
};

export const ACTIVE_STATUSES = ['dispatch_notified', 'responder_en_route', 'responder_arrived'];

export function isActiveStatus(status) {
  return ACTIVE_STATUSES.includes(status);
}

export function statusBadgeVariant(status) {
  if (status === 'resolved') return 'resolved';
  if (status === 'dispatch_notified') return 'active';
  if (isActiveStatus(status)) return 'progress';
  return 'muted';
}

/** dd/mm/yyyy, 24-hour time — the convention used in South Africa. */
const dateTimeFmt = new Intl.DateTimeFormat('en-ZA', {
  timeZone: 'Africa/Johannesburg',
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: false
});

const dateFmt = new Intl.DateTimeFormat('en-ZA', {
  timeZone: 'Africa/Johannesburg',
  weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
});

const timeFmt = new Intl.DateTimeFormat('en-ZA', {
  timeZone: 'Africa/Johannesburg',
  hour: '2-digit', minute: '2-digit', hour12: false
});

export function formatDateTime(iso) {
  if (!iso) return '—';
  return dateTimeFmt.format(new Date(iso));
}

export function formatDate(iso) {
  if (!iso) return '—';
  return dateFmt.format(new Date(iso));
}

export function formatTime(iso) {
  if (!iso) return '—';
  return timeFmt.format(new Date(iso));
}

/** Short label for list rows: "12/10/2026, 21:14". */
export function formatShort(iso) {
  return formatDateTime(iso);
}

export const COMPANY = {
  name: 'Sentinel Armed Response',
  tagline: 'Armed Response — Pretoria',
  controlRoomPhone: '+27 12 555 0100',
  infoOfficerEmail: 'informationofficer@sentinelarmed.co.za'
};

export const EMERGENCY_NUMBERS = [
  { label: 'South African Police Service', number: '10111' },
  { label: 'Ambulance (emergency)', number: '10177' },
  { label: 'Sentinel control room', number: COMPANY.controlRoomPhone }
];

export const POPIA_NOTICE = `
Sentinel Armed Response processes your personal information (identity, contact
details, address, medical information and location) for the purpose of
providing armed response and emergency assistance, as permitted by section 27
of the Protection of Personal Information Act 4 of 2013 (POPIA). Your medical
information is shared only with dispatched responders and the control room.
Location data is captured only when you trigger an alert or run a test.
Alert records are retained for 5 years for account and legal purposes, after
which they are securely destroyed. You may request access to, correction of,
or deletion of your information at any time by contacting the information
officer at ${COMPANY.infoOfficerEmail}. If you are not satisfied with our
response you may complain to the Information Regulator (South Africa).
`.trim();
