export type SharePermission = 'edit' | 'view'

export type ShareMember = {
  id: string
  name: string
  email: string
  permission: SharePermission | 'owner'
  /** An invitation not accepted yet, with when it expires. */
  pendingUntil?: string
  you?: boolean
}

export type ShareLinkState =
  | { access: 'restricted' }
  | { access: 'link'; permission: SharePermission; copyable: boolean }
