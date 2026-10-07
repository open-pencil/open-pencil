import { defineCommand } from 'citty'

import type { TokensResult } from '@open-pencil/core/rpc'

import { fmtList } from '#cli/format'
import { loadRPCData } from '#cli/rpc-data'

import { variableCommandArgs } from './variables'

export default defineCommand({
  meta: {
    description:
      'Print design variables as a stylesheet of CSS custom properties, or as a Tailwind v4 theme'
  },
  args: {
    ...variableCommandArgs,
    format: {
      type: 'string',
      description: 'css (:root and mode scopes) or tailwind (@theme, mode scopes and variants)',
      default: 'css'
    }
  },
  async run({ args }) {
    const data = await loadRPCData<TokensResult>(
      args.file,
      'tokens',
      { format: args.format, collection: args.collection, type: args.type },
      args
    )

    if (args.json) {
      console.log(JSON.stringify(data, null, 2))
      return
    }

    if (data.tokenCount === 0) {
      console.error('No variables found.')
      return
    }

    // The stylesheet goes to stdout so it can be redirected; what was left out goes to stderr.
    process.stdout.write(data.css)
    if (data.issues.length > 0) {
      console.error(
        fmtList(
          data.issues.map((issue) => ({ header: issue })),
          { compact: true }
        )
      )
    }
  }
})
