import type { CloudActor } from '#cloud/server/auth'

export type CloudAPIEnvironment = {
  Variables: {
    actor: CloudActor
  }
}
