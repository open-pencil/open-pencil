import { resolve } from 'node:path'

const deployDirectory = resolve(import.meta.dir, '../../deploy')
const compose = [
  'docker',
  'compose',
  '--project-name',
  `openpencil-cloud-e2e-${process.pid}`,
  '-f',
  'compose.yml'
]

async function run(command: string[], cwd = deployDirectory): Promise<void> {
  const process = Bun.spawn(command, {
    cwd,
    env: { ...Bun.env, S3_BUCKET: Bun.env.S3_BUCKET ?? 'openpencil' },
    stderr: 'inherit',
    stdout: 'inherit'
  })
  const exitCode = await process.exited
  if (exitCode !== 0) throw new Error(`${command.join(' ')} exited with code ${exitCode}`)
}

try {
  await run([...compose, 'up', '-d', '--wait', 'postgres', 'seaweedfs'])
  await run([...compose, 'run', '--rm', 'seaweedfs-init'])
  await run(['bun', resolve(import.meta.dir, 'object-store.ts')], import.meta.dir)
  await run(['bun', resolve(import.meta.dir, 'cloud.ts')], import.meta.dir)
} finally {
  await run([...compose, 'down', '--volumes'])
}
