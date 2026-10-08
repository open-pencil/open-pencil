import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { defineCommand } from 'citty'

import type { TokensResult } from '@open-pencil/core/rpc'

import { fmtList } from '#cli/format'
import { loadRPCData } from '#cli/rpc-data'

import { variableCommandArgs } from './variables'

export default defineCommand({
  meta: {
    description:
      'Print design variables as a stylesheet of CSS custom properties or a Tailwind v4 theme, or write them as W3C design token files'
  },
  args: {
    ...variableCommandArgs,
    format: {
      type: 'string',
      description:
        'css (:root and mode scopes), tailwind (@theme, mode scopes and variants), or dtcg (W3C design token files: one per collection mode, styles, and a resolver; needs --out)',
      default: 'css'
    },
    out: {
      type: 'string',
      alias: 'o',
      description: 'Folder to write dtcg token files into'
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

    if (data.files) {
      if (!args.out) throw new Error('The dtcg format writes several files: pass --out <folder>.')
      for (const file of data.files) {
        const path = join(args.out, file.path)
        await mkdir(dirname(path), { recursive: true })
        await writeFile(path, `${JSON.stringify(file.content, null, 2)}\n`)
      }
      console.error(`Wrote ${data.files.length} files to ${args.out}`)
    } else if (data.tokenCount === 0) {
      console.error('No variables found.')
      return
    }

    // The stylesheet goes to stdout so it can be redirected; what was left out goes to stderr.
    if (!data.files) process.stdout.write(data.css)
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
