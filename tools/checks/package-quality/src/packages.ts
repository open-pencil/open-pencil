import { discoverPublicPackages } from '@open-pencil/package-artifacts-tools'

export async function publicPackageDirs(root: string): Promise<string[]> {
  return (await discoverPublicPackages(root)).map(({ directory }) => directory)
}
