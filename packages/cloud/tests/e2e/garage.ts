import { cloudDeployPath, cloudPackagePath } from '#cloud-tests/helpers/paths'
import { composeCommand, runProcess } from '#cloud-tests/helpers/process'

const deployDirectory = cloudDeployPath()
const objectStoreTest = cloudPackagePath('tests/e2e/object-store.ts')
const projectName = `openpencil-cloud-garage-e2e-${process.pid}`
const compose = composeCommand(projectName, 'compose.garage.yml')
const environment = {
  ...process.env,
  S3_COMPAT_PROVIDER: 'Garage',
  S3_ENDPOINT: 'http://localhost:3900',
  S3_REGION: 'garage',
  S3_BUCKET: process.env.GARAGE_BUCKET ?? 'openpencil',
  S3_ACCESS_KEY_ID: process.env.GARAGE_ACCESS_KEY_ID ?? 'GKopenpencildevelopment0000000000',
  S3_SECRET_ACCESS_KEY:
    process.env.GARAGE_SECRET_ACCESS_KEY ?? 'openpencil-garage-development-secret-key'
}

async function run(command: string[], cwd = deployDirectory): Promise<void> {
  await runProcess(command, { cwd, environment })
}

try {
  await run([...compose, 'up', '-d', '--wait'])
  await run(['bun', objectStoreTest], cloudPackagePath('tests/e2e'))
} finally {
  await run([...compose, 'down', '--volumes'])
}
