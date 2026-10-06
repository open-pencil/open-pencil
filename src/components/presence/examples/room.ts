import type { PresencePersonRow } from '../rows'

/** Sample collaborators for presence stories: you, then Ana with two agents, then Ben. */
export const colors = {
  ana: { r: 0.92, g: 0.34, b: 0.29, a: 1 },
  ben: { r: 0.2, g: 0.55, b: 0.95, a: 1 },
  cleo: { r: 0.6, g: 0.36, b: 0.86, a: 1 },
  you: { r: 0.3, g: 0.7, b: 0.45, a: 1 }
}

export const room: PresencePersonRow[] = [
  {
    name: 'Dana',
    color: colors.you,
    agents: [{ id: 'fern', name: 'Fern', status: 'editing', page: 'Checkout', renamable: true }]
  },
  {
    clientId: 2,
    name: 'Ana',
    color: colors.ana,
    agents: [
      { id: 'orbit', name: 'Orbit', status: 'thinking', page: 'Cover', renamable: false },
      { id: 'pixel', name: 'Pixel', status: 'idle', renamable: false }
    ]
  },
  { clientId: 3, name: 'Ben', color: colors.ben, agents: [] }
]
