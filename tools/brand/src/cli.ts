import { parseArgs } from 'node:util'

import * as v from 'valibot'

import { checkBrandAssets } from './check.ts'
import { repositoryRoot, targets } from './config.ts'
import { ensureBrandAssets } from './generate.ts'

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: { target: { type: 'string', multiple: true }, force: { type: 'boolean' } }
})
const command = v.parse(v.picklist(['generate', 'check']), positionals[0] ?? 'generate')
if (positionals.length > 1)
  throw new Error('Usage: brand [generate|check] [--target web|docs|desktop] [--force]')
const selected = v.parse(v.array(v.picklist(targets)), values.target ?? [...targets])
if (command === 'check') await checkBrandAssets(repositoryRoot, selected)
else await ensureBrandAssets(selected, { force: values.force })
