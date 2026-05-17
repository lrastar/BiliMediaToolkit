
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.join(__dirname, '..')
const outputDir = path.join(rootDir, 'releases')
const tempBuildDir = path.join(outputDir, 'BiliMediaToolkit')

console.log('Start packaging BiliMediaToolkit...')

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn('Skip non-existent:', src)
    return
  }
  if (fs.statSync(src).isDirectory()) {
    fs.mkdirSync(dest, { recursive: true })
    const files = fs.readdirSync(src)
    for (const file of files) {
      if (file === 'node_modules' || file === '.git') continue
      copyRecursive(path.join(src, file), path.join(dest, file))
    }
  } else {
    fs.copyFileSync(src, dest)
  }
}

try {
  console.log('\nCleaning old files...')
  fs.rmSync(outputDir, { recursive: true, force: true })
  fs.mkdirSync(outputDir, { recursive: true })
  fs.mkdirSync(tempBuildDir, { recursive: true })

  console.log('\nBuilding frontend...')
  execSync('cd client && npm run build', { cwd: rootDir, stdio: 'inherit' })

  console.log('\nCopying files...')
  copyRecursive(path.join(rootDir, 'server'), path.join(tempBuildDir, 'server'))
  copyRecursive(path.join(rootDir, 'client', 'dist'), path.join(tempBuildDir, 'client', 'dist'))
  fs.copyFileSync(path.join(rootDir, 'package.json'), path.join(tempBuildDir, 'package.json'))
  fs.copyFileSync(path.join(rootDir, 'LICENSE'), path.join(tempBuildDir, 'LICENSE'))
  fs.copyFileSync(path.join(rootDir, 'README.md'), path.join(tempBuildDir, 'README.md'))

  console.log('\nGenerating startup scripts...')
  fs.writeFileSync(path.join(tempBuildDir, 'start.bat'), '@echo off\ntitle BiliMediaToolkit\nchcp 65001 >nul\necho [INFO] Starting BiliMediaToolkit...\ncd server\necho [INFO] Installing dependencies...\nif not exist "node_modules" (npm install --no-audit --no-fund)\necho [INFO] Starting server...\nnode index.js\npause\n')
  fs.writeFileSync(path.join(tempBuildDir, 'start.sh'), '#!/bin/bash\necho "[INFO] Starting BiliMediaToolkit..."\ncd server\necho "[INFO] Installing dependencies..."\nif [ ! -d "node_modules" ]; then npm install --no-audit --no-fund; fi\necho "[INFO] Starting server..."\nnode index.js\n')

  const pkgJson = JSON.parse(fs.readFileSync(path.join(tempBuildDir, 'package.json'), 'utf-8'))
  fs.writeFileSync(path.join(tempBuildDir, 'package.json'), JSON.stringify({ ...pkgJson, scripts: { ...pkgJson.scripts, 'start:win': 'start.bat', 'start:unix': 'bash start.sh' } }, null, 2))
  fs.writeFileSync(path.join(tempBuildDir, '.gitignore'), 'node_modules\nffmpeg.exe\nffmpeg\ndownloads\ndata\n*.tmp\n*.log\n.DS_Store\n')

  console.log('\nPackaging complete!')
  console.log('Output directory:', tempBuildDir)
  console.log('\nStartup:')
  console.log('Windows: Double-click start.bat')
  console.log('Linux/macOS: Run bash start.sh')
} catch (error) {
  console.error('\nPackaging failed:', error)
  process.exit(1)
}

