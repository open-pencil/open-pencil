/** The brand every OpenPencil email shares, from the waitlist to Cloud: its colors and type. */

/** The ivory app-icon tile, served as PNG because mail clients do not draw SVG. */
export const LOGO_URL = 'https://openpencil.dev/brand/app-icon-1024.png'
export const SITE_URL = 'https://openpencil.dev'

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const INK = '#171717'
const MUTED = '#6B6B6B'
/** Deep teal from the mark; white text on it passes WCAG AA. */
const TEAL = '#0A6C65'

/** Inline styles, since mail clients drop most stylesheets. */
export const styles = {
  body: { backgroundColor: '#F5F5EF', fontFamily: FONT, margin: '0', padding: '40px 16px' },
  card: {
    maxWidth: '480px',
    margin: '0 auto',
    padding: '40px',
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    border: '1px solid #E7E5DC'
  },
  logo: { borderRadius: '10px', margin: '0 0 28px' },
  heading: {
    color: INK,
    fontSize: '22px',
    fontWeight: '600',
    lineHeight: '1.3',
    margin: '0 0 12px'
  },
  text: { color: '#404040', fontSize: '15px', lineHeight: '1.6', margin: '0 0 16px' },
  action: { paddingTop: '8px' },
  button: {
    backgroundColor: TEAL,
    borderRadius: '10px',
    color: '#FFFFFF',
    fontSize: '15px',
    fontWeight: '600',
    padding: '12px 22px',
    textDecoration: 'none'
  },
  note: { color: MUTED, fontSize: '13px', lineHeight: '1.6', margin: '28px 0 0' },
  link: { color: TEAL, textDecoration: 'underline' },
  footer: {
    color: MUTED,
    fontSize: '12px',
    lineHeight: '1.6',
    textAlign: 'center' as const,
    margin: '24px 0 0'
  },
  footerLink: { color: MUTED }
}
