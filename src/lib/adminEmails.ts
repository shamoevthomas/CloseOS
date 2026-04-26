// Central whitelist of admin / dev accounts allowed to access the 3 ecosystems
// (Sales, Business, CRM) without needing a row in each product-specific profile
// table. Keep this list tight — every address here bypasses product isolation.

export const ADMIN_EMAILS: ReadonlySet<string> = new Set([
  'teka@closeos.local',
  'shamoovthomas@gmail.com',
])

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.has(email.toLowerCase())
}
