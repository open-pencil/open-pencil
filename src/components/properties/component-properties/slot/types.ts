/** One configured limit of a slot and whether the instance's content meets it. */
export type SlotLimit =
  | { kind: 'minimum'; count: number; met: boolean }
  | { kind: 'maximum'; count: number; met: boolean }
  | { kind: 'preferred'; met: boolean; offending: number }

/** A component the Add instances list can insert into a slot. */
export interface SlotInstanceOption {
  id: string
  name: string
  preferred: boolean
  /** Library or page the component comes from. */
  source: string
}
