import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { fundingURL } from '../src/app/donation/funding.ts'

/**
 * `__OPENPENCIL_DONATION_URL__`: the donation page the repository's `.github/FUNDING.yml` names,
 * or `null` without one, as in a fork that has none, so its build asks for no donations.
 */
export function donationDefine(root: string): Record<string, string> {
  const path = join(root, '.github', 'FUNDING.yml')
  const url = existsSync(path) ? fundingURL(readFileSync(path, 'utf8')) : null
  return { __OPENPENCIL_DONATION_URL__: JSON.stringify(url) }
}
