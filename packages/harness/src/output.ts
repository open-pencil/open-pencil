/**
 * stdout carries the JSONL protocol. Pi and its dependencies also write there: npm runs that
 * prepare a person's Pi packages inherit stdout, and libraries log with `console.log`. Keep
 * npm quiet on success and send every other stdout write to stderr, as Pi's own RPC mode does.
 * Returns the writer that reaches the real stdout.
 */
export function reserveProtocolOutput(): typeof process.stdout.write {
  process.env.npm_config_loglevel = 'silent'
  process.env.npm_config_audit = 'false'
  process.env.npm_config_fund = 'false'
  const writeProtocol = process.stdout.write.bind(process.stdout)
  const writeDiagnostics = process.stderr.write.bind(process.stderr)
  process.stdout.write = writeDiagnostics
  return writeProtocol
}
