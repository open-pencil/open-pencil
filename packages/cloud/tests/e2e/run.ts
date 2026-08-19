import { cloudDeployPath, cloudPackagePath } from '#cloud-test/helpers/paths'
import { composeCommand, runProcess } from '#cloud-test/helpers/process'

const deployDirectory = cloudDeployPath()
const e2ePath = (...segments: string[]) => cloudPackagePath('tests/e2e', ...segments)
const compose = composeCommand(`openpencil-cloud-e2e-${process.pid}`, 'compose.yml')
const portOffset = process.pid % 1_000
const environment = {
  ...Bun.env,
  S3_BUCKET: Bun.env.S3_BUCKET ?? 'openpencil',
  POSTGRES_PORT: String(20_000 + portOffset),
  SEAWEEDFS_S3_PORT: String(21_000 + portOffset),
  SEAWEEDFS_MASTER_PORT: String(22_000 + portOffset),
  DATABASE_URL: `postgresql://openpencil:openpencil-development-password@127.0.0.1:${20_000 + portOffset}/openpencil`,
  S3_ENDPOINT: `http://127.0.0.1:${21_000 + portOffset}`
}

async function run(command: string[], cwd = deployDirectory): Promise<void> {
  await runProcess(command, { cwd, environment })
}

try {
  await run([...compose, 'up', '-d', '--wait', 'postgres', 'seaweedfs'])
  await run([...compose, 'run', '--rm', 'seaweedfs-init'])
  await run(['bun', e2ePath('object-store.ts')], e2ePath())
  await run(['bun', e2ePath('cloud.ts')], e2ePath())
} finally {
  await run([...compose, 'down', '--volumes'])
}
