import { useLocalStorage } from '@vueuse/core'
import * as v from 'valibot'

import { agentPairingTokenSchema } from '@open-pencil/cloud/contract'
import { randomHex } from '@open-pencil/std/random'

const storedPairingSchema = v.object({
  server: v.pipe(v.string(), v.url()),
  token: agentPairingTokenSchema
})

/** A pairing this browser keeps: the server it goes through, and the agent's token. */
export type StoredPairing = v.InferOutput<typeof storedPairingSchema>

/**
 * The pairing of this browser's editor with an agent, kept so closing OpenPencil only pauses it. Every
 * window shares it, and the pairing page writes it before the editor opens.
 */
export const storedPairing = useLocalStorage<StoredPairing | null>(
  'open-pencil:agent-pairing',
  null,
  {
    flush: 'sync',
    writeDefaults: false,
    serializer: {
      read: (text) => {
        const parsed = v.safeParse(v.pipe(v.string(), v.parseJson(), storedPairingSchema), text)
        return parsed.success ? parsed.output : null
      },
      write: (value) => JSON.stringify(value)
    }
  }
)

/** A fresh pairing token. */
export function newPairingToken(): string {
  return `opg_${randomHex(32)}`
}
