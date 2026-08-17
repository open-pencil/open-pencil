import { resolve } from 'node:path'

import { composeCommand, runProcess } from '#cloud-test/helpers/process'

const deployDirectory = resolve(import.meta.dir, '../../deploy')
const projectName = `openpencil-cloud-garage-e2e-${process.pid}`
const compose = composeCommand(projectName, 'compose.garage.yml')
const environment = {
  ...Bun.env,
  S3_COMPAT_PROVIDER: 'Garage',
  S3_ENDPOINT: 'http://localhost:3900',
  S3_REGION: 'garage',
  S3_BUCKET: Bun.env.GARAGE_BUCKET ?? 'openpencil',
  S3_ACCESS_KEY_ID: Bun.env.GARAGE_ACCESS_KEY_ID ?? 'GKopenpencildevelopment0000000000',
  S3_SECRET_ACCESS_KEY:
    Bun.env.GARAGE_SECRET_ACCESS_KEY ?? 'openpencil-garage-development-secret-key'
}

async function run(command: string[], cwd = deployDirectory): Promise<void> {
  await runProcess(command, { cwd, environment })
}

try {
  await run([...compose, 'up', '-d', '--wait'])
  await run(['bun', resolve(import.meta.dir, 'object-store.ts')], import.meta.dir)
} finally {
  await run([...compose, 'down', '--volumes'])
}
