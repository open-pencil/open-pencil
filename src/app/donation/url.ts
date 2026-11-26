/** The donation page `.github/FUNDING.yml` names; without one the app never asks or links. */
export const DONATION_URL: string | null =
  typeof __OPENPENCIL_DONATION_URL__ === 'string' ? __OPENPENCIL_DONATION_URL__ : null
