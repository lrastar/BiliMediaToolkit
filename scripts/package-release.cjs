
const { execSync } = require('child_process');
const { mkdirSync, copyFileSync, rmSync, writeFileSync, readFileSync, existsSync, statSync } = require('fs');
const { join, dirname } = require('path');

const rootDir = join(__dirname, '..');
const outputDir = join(rootDir, 'releases');
const tempBuildDir = join(outputDir, 'BiliMediaToolkit');

console.log('Start packaging BiliMediaToolkit...');

try {
  console.log('\nCleaning old files...');
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });
  mkdirSync(tempBuildDir, { recursive: true });

  console.log('\nBuilding frontend...');
  execSync('cd client &amp;&amp; npm run build', {
    cwd: rootDir,
    stdio: 'inherit'
  });

  console.log('\nCopying files...');
  
  const serverSrc = join(rootDir, 'server');
  const serverDest = join(tempBuildDir, 'server');
  copyRecursive(serverSrc, serverDest);

  const clientDistSrc = join(rootDir, 'client', 'dist');
  const clientDistDest = join(tempBuildDir, 'client', 'dist');
  copyRecursive(clientDistSrc, clientDistDest);

  copyFileSync(join(rootDir, 'package.json'), join(tempBuildDir, 'package.json'));
  copyFileSync(join(rootDir, 'LICENSE'), join(tempBuildDir, 'LICENSE'));
  copyFileSync(join(rootDir, 'README.md'), join(tempBuildDir, 'README.md'));

  console.log('\nGenerating startup scripts...');
  writeFileSync(
    join(tempBuildDir, 'start.bat'),
    '@echo off\ntitle BiliMediaToolkit\nchcp 65001 &gt;nul\necho [INFO] Starting BiliMediaToolkit...\ncd server\necho [INFO] Installing dependencies...\nif not exist "node_modules" (\n  npm install --no-audit --no-fund\n)\necho [INFO] Starting server...\nnode index.js\npause\n'
  );

  writeFileSync(
    join(tempBuildDir, 'start.sh'),
    '#!/bin/bash\necho "[INFO] Starting BiliMediaToolkit..."\ncd server\necho "[INFO] Installing dependencies..."\nif [ ! -d "node_modules" ]; then\n  npm install --no-audit --no-fund\nfi\necho "[INFO] Starting server..."\nnode index.js\n'
  );

  const pkgJson = JSON.parse(readFileSync(join(tempBuildDir, 'package.json'), 'utf-8'));
  writeFileSync(
    join(tempBuildDir, 'package.json'),
    JSON.stringify({
      ...pkgJson,
      scripts: {
        ...pkgJson.scripts,
        'start:win': 'start.bat',
        'start:unix': 'bash start.sh'
      }
    }, null, 2)
  );

  const gitignoreContent = 'node_modules\nffmpeg.exe\nffmpeg\ndownloads\ndata\n*.tmp\n*.log\n.DS_Store\n';
  writeFileSync(join(tempBuildDir, '.gitignore'), gitignoreContent);

  console.log('\nPackaging complete!');
  console.log('Output directory: ' + tempBuildDir);
  console.log('\nStartup:');
  console.log('Windows: Double-click start.bat');
  console.log('Linux/macOS: Run bash start.sh');

} catch (error) {
  console.error('\nPackaging failed:', error);
  process.exit(1);
}

function copyRecursive(src, dest) {
  if (!existsSync(src)) {
    console.warn('Skip non-existent: ' + src);
    return;
  }

  if (statSync(src).isDirectory()) {
    mkdirSync(dest, { recursive: true });
    const files = require('fs').readdirSync(src);
    for (let i = 0; i &lt; files.length; i++) {
      const file = files[i];
      if (file === 'node_modules' || file === '.git') continue;
      copyRecursive(join(src, file), join(dest, file));
    }
  } else {
    copyFileSync(src, dest);
  }
}

