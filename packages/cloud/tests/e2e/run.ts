import { resolve } from 'node:path'

import { composeCommand, runProcess } from '#cloud-test/helpers/process'

const deployDirectory = resolve(import.meta.dir, '../../deploy')
const compose = composeCommand(`openpencil-cloud-e2e-${process.pid}`, 'compose.yml')
const environment = { ...Bun.env, S3_BUCKET: Bun.env.S3_BUCKET ?? 'openpencil' }

async function run(command: string[], cwd = deployDirectory): Promise<void> {
  await runProcess(command, { cwd, environment })
}

try {
  await run([...compose, 'up', '-d', '--wait', 'postgres', 'seaweedfs'])
  await run([...compose, 'run', '--rm', 'seaweedfs-init'])
  await run(['bun', resolve(import.meta.dir, 'object-store.ts')], import.meta.dir)
  await run(['bun', resolve(import.meta.dir, 'cloud.ts')], import.meta.dir)
} finally {
  await run([...compose, 'down', '--volumes'])
}
