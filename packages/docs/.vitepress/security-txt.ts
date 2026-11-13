/** How long a `security.txt` stays valid; RFC 9116 asks for less than a year. */
const VALID_DAYS = 360

/**
 * The site's `security.txt` (RFC 9116), written into the build, so its expiry moves with each
 * release of the site: vulnerabilities go to GitHub Security Advisories, as `SECURITY.md` says.
 */
export function securityTxt(site: string, now: Date): string {
  const expires = new Date(now.getTime() + VALID_DAYS * 24 * 60 * 60 * 1000)
  return [
    'Contact: https://github.com/open-pencil/open-pencil/security/advisories/new',
    `Expires: ${expires.toISOString()}`,
    'Policy: https://github.com/open-pencil/open-pencil/security/policy',
    'Preferred-Languages: en',
    `Canonical: ${site}/.well-known/security.txt`,
    ''
  ].join('\n')
}
