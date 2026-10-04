import { appTargetOptions } from '#cli/app-target'

/** The document and node pair every two-node diff command takes. */
export const nodePairArgs = {
  file: {
    type: 'positional',
    description: 'Document file path (omit to connect to running app)',
    required: false
  },
  from: { type: 'string', description: 'Source node ID', required: true },
  to: { type: 'string', description: 'Target node ID', required: true },
  ...appTargetOptions,
  json: { type: 'boolean', description: 'Output as JSON' }
} as const
