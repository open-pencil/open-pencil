import { cloudDeployPath, cloudPackagePath } from '#cloud-test/helpers/paths'
import { composeCommand, runProcess } from '#cloud-test/helpers/process'

const deployDirectory = cloudDeployPath()
const e2ePath = (...segments: string[]) => cloudPackagePath('tests/e2e', ...segments)
const compose = composeCommand(`openpencil-cloud-e2e-${process.pid}`, 'compose.yml')
const environment = { ...Bun.env, S3_BUCKET: Bun.env.S3_BUCKET ?? 'openpencil' }

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
