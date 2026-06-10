import { spawn } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

interface PackageJSON {
  scripts?: Record<string, string>
}

async function run(command: string, args: string[], cwd: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} failed in ${cwd}`))
    })
  })
}

for (const entry of await readdir('tools', { withFileTypes: true })) {
  if (!entry.isDirectory()) continue

  const cwd = join('tools', entry.name)
  const packageJSON = JSON.parse(await readFile(join(cwd, 'package.json'), 'utf8')) as PackageJSON
  if (packageJSON.scripts?.test) await run('bun', ['test'], cwd)
}
