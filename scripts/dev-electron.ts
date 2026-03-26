import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The `electron` package default-exports the path to the binary.
// We use a dynamic import so this ESM script can resolve it at runtime.
const electronModule = await import('electron')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const electronPath: string = (electronModule.default ?? electronModule) as any

const env = { ...process.env }
// CRITICAL: Unset this so the process runs as Electron, not plain Node
delete env.ELECTRON_RUN_AS_NODE

console.log('[DevLauncher] Starting Electron...')
console.log('[DevLauncher] Electron Path:', electronPath)

const child = spawn(
  electronPath,
  [path.join(__dirname, '../electron/main.cjs')],
  {
    env,
    stdio: 'inherit',
    shell: true,
  }
)

child.on('exit', (code) => {
  console.log(`[DevLauncher] Electron exited with code ${code}`)
  process.exit(code ?? 0)
})

child.on('error', (err) => {
  console.error('[DevLauncher] Failed to start Electron:', err)
  process.exit(1)
})
