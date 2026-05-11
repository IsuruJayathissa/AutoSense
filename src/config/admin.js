// Admin access control for AutoSense
//
// Add any email here that should be able to access the Admin screen.
// Comparison is case-insensitive. Empty list = no admins.
//
// To add yourself: just append your Firebase Auth email below.
export const ADMIN_EMAILS = [
  'isurujayathissa1999@gmail.com',
];

export function isAdminEmail(email) {
  if (!email) return false;
  const normalized = String(email).toLowerCase().trim();
  return ADMIN_EMAILS.some(a => a.toLowerCase() === normalized);
}
