import { defineCommand } from 'citty'

import { diffDocuments } from '@open-pencil/core/tools'

import { bold, dim, ok, printError } from '#cli/format'
import { loadDocument, populateWholeDocument } from '#cli/headless'

import { printUnifiedDiff } from './output'

export default defineCommand({
  meta: { description: 'Structural diff of two documents, page by page' },
  args: {
    before: { type: 'positional', description: 'Original document path', required: true },
    after: { type: 'positional', description: 'Changed document path', required: true },
    page: { type: 'string', description: 'Compare only the page with this name' },
    depth: { type: 'string', description: 'Max tree depth below each page (default: unlimited)' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const depth = args.depth ? Number(args.depth) : undefined
    if (depth !== undefined && !(Number.isInteger(depth) && depth >= 0)) {
      // Like diff(1): exit 2 on trouble, since 1 means the documents differ.
      printError(`--depth must be a non-negative integer, got "${args.depth}"`)
      process.exit(2)
    }
    // Load in order: node IDs count up per process, so the first document gets the IDs a
    // single load gives it, and the patch applies to it with `diff apply`.
    const before = await loadDocument(args.before)
    const after = await loadDocument(args.after)
    populateWholeDocument(before)
    populateWholeDocument(after)
    const result = diffDocuments(before, after, { page: args.page, depth })
    if (args.page && result.pages.length === 0) {
      printError(`Neither document has a page named "${args.page}"`)
      process.exit(2)
    }

    if (args.json) {
      console.log(JSON.stringify(result, null, 2))
    } else if (!result.changed) {
      console.log(ok('Documents match'))
    } else {
      for (const page of result.pages) {
        if (page.diff) {
          if (process.stdout.isTTY) console.log(bold(`\n  ${page.name} (${page.status})\n`))
          printUnifiedDiff(page.diff)
        } else if (page.status !== 'unchanged') {
          // On stderr, so piped output stays a patch; patches do not add or remove pages.
          console.error(dim(`Page "${page.name}" ${page.status}`))
        }
      }
    }
    // Like diff(1): exit 1 when the documents differ, so scripts can branch on it.
    if (result.changed) process.exitCode = 1
  }
})
