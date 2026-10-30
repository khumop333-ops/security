/**
 * Company mark — a simple line shield with an "S" monogram.
 * Outline style, consistent stroke weight (matches the icon system).
 */
export function Logo({ size = 36, color = '#FFFFFF' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Sentinel Armed Response logo"
    >
      <path d="M18 3.5 L31 8.5 V18 c0 7.5 -5.2 12.2 -13 14.5 C10.2 30.2 5 25.5 5 18 V8.5 Z" />
      <path d="M22.5 13 c-1.2 -1.6 -2.9 -2.4 -4.8 -2.4 -2.6 0 -4.4 1.4 -4.4 3.4 0 4.6 9.6 2.6 9.6 7.2 0 2.2 -2 3.7 -4.9 3.7 -2.2 0 -4.1 -0.9 -5.4 -2.6" />
    </svg>
  );
}
