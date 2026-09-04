import { mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { composeProjectName, localCloudDeploymentTOML } from './config'

const repositoryRoot = resolve(import.meta.dir, '../../../..')
const composeFile = resolve(repositoryRoot, 'packages/cloud/deploy/compose.yml')
const generatedDirectory = resolve(repositoryRoot, 'packages/cloud/deploy/generated')
const generatedConfig = resolve(generatedDirectory, 'openpencil-cloud.local.toml')

async function output(command: string[]): Promise<string> {
  const process = Bun.spawn(command, {
    cwd: repositoryRoot,
    stdout: 'pipe',
    stderr: 'pipe'
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited
  ])
  if (exitCode !== 0) throw new Error(stderr.trim() || `${command[0]} exited with ${exitCode}`)
  return stdout.trim()
}

async function execute(
  command: string[],
  options: { allowFailure?: boolean; environment?: Record<string, string | undefined> } = {}
): Promise<void> {
  const process = Bun.spawn(command, {
    cwd: repositoryRoot,
    env: options.environment,
    stdout: 'inherit',
    stderr: 'inherit'
  })
  const exitCode = await process.exited
  if (exitCode !== 0 && !options.allowFailure) {
    throw new Error(`${command[0]} exited with ${exitCode}`)
  }
}

async function portlessURL(name: string): Promise<string> {
  return output(['bunx', 'portless', 'get', name])
}

async function branchName(): Promise<string> {
  return output(['git', 'branch', '--show-current'])
}

async function composePort(project: string, service: string, port: number): Promise<number> {
  const address = await output([
    'docker',
    'compose',
    '--project-name',
    project,
    '--file',
    composeFile,
    'port',
    service,
    String(port)
  ])
  const value = Number(address.slice(address.lastIndexOf(':') + 1))
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`Could not resolve the ${service} development port`)
  }
  return value
}

function aliasName(url: string): string {
  const hostname = new URL(url).hostname
  const suffix = '.localhost'
  if (!hostname.endsWith(suffix)) throw new Error(`Portless returned an unexpected URL: ${url}`)
  return hostname.slice(0, -suffix.length)
}

async function registerAlias(name: string, port: number): Promise<void> {
  await execute(['bunx', 'portless', 'alias', name, String(port), '--force'])
}

async function removeAlias(name: string): Promise<void> {
  await execute(['bunx', 'portless', 'alias', '--remove', name], { allowFailure: true })
}

async function stop(project: string): Promise<void> {
  await execute(['docker', 'compose', '--project-name', project, '--file', composeFile, 'down'], {
    allowFailure: true
  })
  const [cloudURL, mailURL] = await Promise.all([
    portlessURL('cloud.open-pencil'),
    portlessURL('mail.open-pencil')
  ])
  await Promise.all([removeAlias(aliasName(cloudURL)), removeAlias(aliasName(mailURL))])
}

async function start(): Promise<void> {
  const branch = await branchName()
  const project = composeProjectName(branch)
  const cloudURL = await portlessURL('cloud.open-pencil')
  const mailURL = await portlessURL('mail.open-pencil')
  const editorURL = await portlessURL('open-pencil')

  await mkdir(generatedDirectory, { recursive: true })
  await writeFile(generatedConfig, localCloudDeploymentTOML({ cloudURL, editorURL }), {
    mode: 0o600
  })

  const environment = {
    ...process.env,
    OPENPENCIL_CLOUD_CONFIG_FILE: generatedConfig,
    OPENPENCIL_CLOUD_PORT: '0',
    MAILPIT_UI_PORT: '0',
    POSTGRES_PORT: '0',
    SEAWEEDFS_S3_PORT: '0',
    SEAWEEDFS_MASTER_PORT: '0'
  }
  await execute(
    [
      'docker',
      'compose',
      '--project-name',
      project,
      '--file',
      composeFile,
      'up',
      '--detach',
      '--build',
      '--wait'
    ],
    { environment }
  )
  const [cloudPort, mailpitPort] = await Promise.all([
    composePort(project, 'cloud', 8787),
    composePort(project, 'mailpit', 8025)
  ])
  try {
    await registerAlias(aliasName(cloudURL), cloudPort)
    await registerAlias(aliasName(mailURL), mailpitPort)
  } catch (error) {
    await stop(project)
    throw error
  }

  console.warn(`OpenPencil Cloud: ${cloudURL}`)
  console.warn(`Captured email:  ${mailURL}`)
}

const command = process.argv[2] ?? 'up'
const project = composeProjectName(await branchName())
if (command === 'up') await start()
else if (command === 'down') {
  await stop(project)
  await rm(generatedDirectory, { recursive: true, force: true })
} else {
  throw new Error('Usage: cloud-local-dev [up|down]')
}
