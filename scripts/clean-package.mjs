import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDir, '..')
const cleanTargets = ['out', 'release']

for (const name of cleanTargets) {
  const target = path.resolve(projectRoot, name)
  if (path.dirname(target) !== projectRoot) {
    throw new Error(`Refusing to clean a path outside the project root: ${target}`)
  }

  await rm(target, { recursive: true, force: true })
  await mkdir(target, { recursive: true })
  console.log(`Cleaned ${path.relative(projectRoot, target)}`)
}
