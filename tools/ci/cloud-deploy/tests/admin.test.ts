import { describe, expect, test } from 'bun:test'

import { connectionStringArgs, runOfficialAdmin, verifiedAddress } from '#cloud-deploy/admin'

import { CommandError, type CommandRequest } from '@open-pencil/package-artifacts-tools'

const ADDRESS =
  'postgresql://migrator:secret@example.neon.tech/openpencil_cloud?sslmode=require&channel_binding=require'

function recorder(fail?: 'neonctl' | 'bun') {
  const requests: CommandRequest[] = []
  const execute = async (request: CommandRequest) => {
    requests.push(request)
    if (request.command === fail) {
      throw new CommandError('failed', request, 1, '', 'not logged in', false)
    }
    return { stdout: request.command === 'neonctl' ? `${ADDRESS}\n` : '', stderr: '' }
  }
  return { requests, execute }
}

describe('connectionStringArgs', () => {
  test('names the branch only where the database is not on the default one', () => {
    expect(connectionStringArgs('staging').slice(0, 2)).toEqual(['connection-string', 'staging'])
    expect(connectionStringArgs('production')[1]).toBe('--project-id')
  })
})

describe('verifiedAddress', () => {
  test('verifies TLS in full and keeps the rest of the address', () => {
    const url = new URL(verifiedAddress(ADDRESS))
    expect(url.searchParams.get('sslmode')).toBe('verify-full')
    expect(url.searchParams.get('channel_binding')).toBe('require')
    expect(url.password).toBe('secret')
  })
})

describe('runOfficialAdmin', () => {
  test('hands the address to the admin command through its environment only', async () => {
    const { requests, execute } = recorder()
    await runOfficialAdmin(['production', 'grant', 'owner@example.com'], '/repo', execute)
    const admin = requests[1]
    expect(admin?.args).toEqual([
      '--filter',
      '@open-pencil/cloud',
      'admin',
      'grant',
      'owner@example.com'
    ])
    expect(admin?.env?.DATABASE_URL).toBe(verifiedAddress(ADDRESS))
    expect(admin?.output).toBe('inherit')
  })

  test('passes a request’s name on to the admin command', async () => {
    const { requests, execute } = recorder()
    await runOfficialAdmin(['production', 'request', 'ada@example.com', 'Ada'], '/repo', execute)
    expect(requests[1]?.args?.slice(3)).toEqual(['request', 'ada@example.com', 'Ada'])
  })

  test('refuses unknown targets and operations before asking neonctl', async () => {
    const { requests, execute } = recorder()
    for (const args of [
      ['preview', 'grant', 'a@b.c'],
      ['staging', 'delete', 'a@b.c'],
      ['staging', 'grant']
    ]) {
      await expect(runOfficialAdmin(args, '/repo', execute)).rejects.toThrow('Usage')
    }
    expect(requests).toEqual([])
  })

  test('reports failures without the address', async () => {
    for (const fail of ['neonctl', 'bun'] as const) {
      const { execute } = recorder(fail)
      const error = await runOfficialAdmin(['staging', 'approve', 'a@b.c'], '/repo', execute).catch(
        (caught: unknown) => caught
      )
      expect(error).toBeInstanceOf(Error)
      expect(Object.keys(error as Error)).toEqual([])
      expect(String(error)).not.toContain('secret')
    }
  })
})
