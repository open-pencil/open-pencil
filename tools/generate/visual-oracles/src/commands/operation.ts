import { defineCommand } from 'citty'

export function operationCommand(name: string, description: string, entrypoint: string) {
  return defineCommand({
    meta: { name, description },
    async run({ rawArgs }) {
      const process = Bun.spawn(['bun', entrypoint, ...rawArgs], {
        stdin: 'inherit',
        stdout: 'inherit',
        stderr: 'inherit'
      })
      const exitCode = await process.exited
      if (exitCode !== 0) throw new Error(`${name} exited with code ${exitCode}`)
    }
  })
}
