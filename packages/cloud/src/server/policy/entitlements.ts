export type EntitlementSubject = {
  type: 'workspace' | 'user' | 'organization' | 'deployment'
  id: string
}

export type EntitlementSource = {
  boolean(subject: EntitlementSubject, key: string): Promise<boolean | null>
  number(subject: EntitlementSubject, key: string): Promise<number | null>
  string(subject: EntitlementSubject, key: string): Promise<string | null>
}

export class StaticEntitlementSource implements EntitlementSource {
  constructor(private readonly values: Readonly<Record<string, boolean | number | string>>) {}

  async boolean(_subject: EntitlementSubject, key: string): Promise<boolean | null> {
    const value = this.values[key]
    return typeof value === 'boolean' ? value : null
  }

  async number(_subject: EntitlementSubject, key: string): Promise<number | null> {
    const value = this.values[key]
    return typeof value === 'number' ? value : null
  }

  async string(_subject: EntitlementSubject, key: string): Promise<string | null> {
    const value = this.values[key]
    return typeof value === 'string' ? value : null
  }
}
