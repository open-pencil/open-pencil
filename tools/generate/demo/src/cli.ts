import { ensureDemoDocument } from './ensure'

await ensureDemoDocument({ force: process.argv.includes('--force') })
