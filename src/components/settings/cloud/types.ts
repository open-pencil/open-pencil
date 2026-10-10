/** A Cloud server this app has connected to, and how its account stands on this device. */
export type CloudServerEntry = {
  id: string
  host: string
  kind: 'official' | 'self-hosted'
  account: { id: string; name: string; email: string } | null
  /** `expired` keeps the account so the person can sign back in to the same one. */
  session: 'signed-in' | 'expired' | 'signed-out'
  /** The server whose workspaces Home shows. */
  onHome: boolean
  /** Documents with changes that have not reached this server yet. */
  unsaved: number
}
