import { defineCommand } from 'citty'

import { runAppCommand } from '#cli/app/command'
import { appTargetOptions, appTargetRPCArgs } from '#cli/app/target'
import { ok } from '#cli/format'

interface HistoryResult {
  applied: boolean
  label: string | null
}

function historyCommand(command: 'undo' | 'redo', verb: string) {
  return defineCommand({
    meta: {
      description: `${verb} the last change made through automation in a document open in the running app`
    },
    args: {
      ...appTargetOptions,
      json: { type: 'boolean', description: 'Output as JSON' }
    },
    run: ({ args }) =>
      runAppCommand(command, appTargetRPCArgs(args), {
        json: args.json,
        message: (response) => {
          const result = response as HistoryResult
          if (!result.applied) return `Nothing to ${command}`
          const label = result.label ? `: ${result.label}` : ''
          return ok(`${verb === 'Undo' ? 'Undid' : 'Redid'}${label}`)
        }
      })
  })
}

export const undo = historyCommand('undo', 'Undo')
export const redo = historyCommand('redo', 'Redo')
