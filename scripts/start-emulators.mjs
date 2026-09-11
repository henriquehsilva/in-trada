import { existsSync, mkdirSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { join } from 'node:path'

const dataDirectory = join(process.cwd(), 'firebase-data')
const exportMetadata = join(dataDirectory, 'firebase-export-metadata.json')

mkdirSync(dataDirectory, { recursive: true })

const args = [
  'emulators:start',
  '--only=auth,firestore,storage',
  `--export-on-exit=${dataDirectory}`,
]

// O Firebase recusa --import quando ainda não existe uma exportação válida.
// A partir da segunda execução, os dados salvos são restaurados automaticamente.
if (existsSync(exportMetadata)) {
  args.push(`--import=${dataDirectory}`)
}

const firebaseCommand = process.platform === 'win32' ? 'firebase.cmd' : 'firebase'
const emulatorProcess = spawn(firebaseCommand, args, { stdio: 'inherit' })

// Em um terminal, o Firebase e este processo recebem o mesmo sinal. Mantemos o
// processo intermediário vivo até o Firebase terminar a exportação e encerrar.
process.on('SIGINT', () => {})
process.on('SIGTERM', () => {})

emulatorProcess.on('error', error => {
  console.error(`Não foi possível iniciar o Firebase CLI: ${error.message}`)
  process.exitCode = 1
})

emulatorProcess.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0)
})
