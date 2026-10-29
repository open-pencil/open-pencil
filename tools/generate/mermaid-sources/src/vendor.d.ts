declare module 'jison' {
  interface GeneratorOptions {
    moduleType?: 'js' | 'commonjs' | 'amd'
    'token-stack'?: boolean
  }

  class Generator {
    constructor(grammar: string, options?: GeneratorOptions)
    generate(options?: { moduleMain?: string }): string
  }

  const jison: { Generator: typeof Generator }
  export default jison
}
