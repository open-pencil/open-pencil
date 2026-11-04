// Writes THIRD-PARTY-NOTICES.md from the licenses of the crates compiled into html-engine.wasm,
// with cargo-about; `--check` fails instead when the committed file differs.
//   bun scripts/notices.ts [--check]
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const PACKAGE = join(import.meta.dir, '..')
const NOTICES = join(PACKAGE, 'THIRD-PARTY-NOTICES.md')

const child = Bun.spawn(
  [
    'cargo',
    'about',
    'generate',
    '--config',
    'about.toml',
    '--manifest-path',
    'crate/Cargo.toml',
    '--locked',
    'about.hbs'
  ],
  { cwd: PACKAGE, stdout: 'pipe', stderr: 'inherit' }
)
const [notices, code] = await Promise.all([new Response(child.stdout).text(), child.exited])
if (code !== 0)
  throw new Error(`cargo about exited with ${code}; install it with cargo install cargo-about`)

if (process.argv.includes('--check')) {
  const committed = await readFile(NOTICES, 'utf8').catch(() => '')
  if (committed !== notices) {
    throw new Error('THIRD-PARTY-NOTICES.md is stale; run bun run generate:notices')
  }
  process.stdout.write('THIRD-PARTY-NOTICES.md is up to date\n')
} else {
  await writeFile(NOTICES, notices)
  process.stdout.write('Wrote THIRD-PARTY-NOTICES.md\n')
}
