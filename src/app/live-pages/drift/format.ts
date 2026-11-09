/**
 * When a baseline was taken, in the language the person chose. A stamp the document carries but
 * nothing can read answers empty rather than printing "Invalid Date" into the panel.
 */
export function baselineMoment(capturedAt: string, locale: string): string {
  const moment = new Date(capturedAt)
  if (Number.isNaN(moment.getTime())) return ''
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(moment)
}
