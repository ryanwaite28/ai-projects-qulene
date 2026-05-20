/**
 * Design tokens — single source of truth for brand colors and status badge
 * class strings shared across the web app, marketing site, and mobile app.
 *
 * Tailwind / NativeWind configs extend their themes with `brandColors`.
 * Components reference `appointmentStatusClasses` and `waitlistStatusClasses`
 * directly instead of defining their own per-file STATUS_STYLES constants.
 */

export const brandColors = {
  50:  '#eef2ff',
  100: '#e0e7ff',
  500: '#6366f1',
  600: '#4f46e5',
  700: '#4338ca',
} as const;

/**
 * Maps AppointmentStatus → Tailwind bg+text utility classes.
 * DECLINED uses red (active rejection by business) to distinguish it from
 * CANCELLED (gray, customer-initiated cancellation).
 */
export const appointmentStatusClasses: Record<string, string> = {
  PENDING:   'bg-yellow-100 text-yellow-800',
  ACCEPTED:  'bg-green-100  text-green-800',
  DECLINED:  'bg-red-100    text-red-800',
  CANCELLED: 'bg-gray-100   text-gray-600',
  COMPLETED: 'bg-blue-100   text-blue-800',
  NO_SHOW:   'bg-orange-100 text-orange-800',
};

export const appointmentStatusLabels: Record<string, string> = {
  PENDING:   'Pending',
  ACCEPTED:  'Accepted',
  DECLINED:  'Declined',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
  NO_SHOW:   'No Show',
};

/** Maps WaitlistStatus → Tailwind bg+text utility classes. */
export const waitlistStatusClasses: Record<string, string> = {
  ACTIVE:   'bg-blue-100  text-blue-800',
  PROMOTED: 'bg-green-100 text-green-800',
  REMOVED:  'bg-gray-100  text-gray-500',
};
