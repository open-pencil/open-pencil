/** The workspace's plan does not include services. */
export class ServicesNotEntitledError extends Error {
  constructor() {
    super('The workspace is not entitled to services')
    this.name = 'ServicesNotEntitledError'
  }
}
