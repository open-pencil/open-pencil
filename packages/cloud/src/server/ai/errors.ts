/** The workspace's plan does not include the AI service. */
export class AINotEntitledError extends Error {
  constructor() {
    super('The workspace is not entitled to the AI service')
    this.name = 'AINotEntitledError'
  }
}
