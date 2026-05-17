
#!/usr/bin/env node

import { execSync } from 'child_process';
import {
  mkdirSync,
  copyFileSync,
  rmSync,
  writeFileSync,
  readFileSync
} from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const outputDir = join(rootDir, 'releases');
const tempBuildDir = join(outputDir, 'BiliMediaToolkit');

console.log('🚀 开始打包 BiliMediaToolkit...');

try {
  console.log('\n📁 清理旧文件...');
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });
  mkdirSync(tempBuildDir, { recursive: true });

  console.log('\n🏗️  构建前端...');
  execSync('cd client && npm run build', {
    cwd: rootDir,
    stdio: 'inherit'
  });

  console.log('\n📦 复制文件...');
  
  const copyItems = [
    ['server', join(tempBuildDir, 'server')],
    ['client/dist', join(tempBuildDir, 'client', 'dist')],
    ['package.json', join(tempBuildDir, 'package.json')],
    ['LICENSE', join(tempBuildDir, 'LICENSE')],
    ['README.md', join(tempBuildDir, 'README.md')]
  ];

  copyItems.forEach(([src, dest]) => {
    const srcPath = join(rootDir, src);
    copyRecursive(srcPath, dest);
  });

  console.log('\n📝 生成启动脚本...');
  writeFileSync(
    join(tempBuildDir, 'start.bat'),
    `@echo off
title BiliMediaToolkit
chcp 65001 >nul
echo [INFO] 正在启动 BiliMediaToolkit...
cd server
echo [INFO] 正在安装依赖...
if not exist "node_modules" (
  npm install --no-audit --no-fund
)
echo [INFO] 正在启动服务器...
node index.js
pause
`
  );

  writeFileSync(
    join(tempBuildDir, 'start.sh'),
    `#!/bin/bash
echo "[INFO] 正在启动 BiliMediaToolkit..."
cd server
echo "[INFO] 正在安装依赖..."
if [ ! -d "node_modules" ]; then
  npm install --no-audit --no-fund
fi
echo "[INFO] 正在启动服务器..."
node index.js
`
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

  const gitignoreContent = `node_modules
ffmpeg.exe
ffmpeg
downloads
data
*.tmp
*.log
.DS_Store
`;
  writeFileSync(join(tempBuildDir, '.gitignore'), gitignoreContent);

  console.log('\n✅ 打包完成！');
  console.log(`输出目录: ${tempBuildDir}`);
  console.log(`\n启动方式:`);
  console.log(`Windows: 双击 start.bat`);
  console.log(`Linux/macOS: 执行 bash start.sh`);

} catch (error) {
  console.error('\n❌ 打包失败:', error);
  process.exit(1);
}

function copyRecursive(src, dest) {
  const stat = (path) => {
    try {
      return {
        exists: true,
        isDirectory: () => require('fs').statSync(path).isDirectory()
      };
    } catch {
      return { exists: false, isDirectory: () => false };
    }
  };

  const s = stat(src);
  if (!s.exists) {
    console.warn(`⚠️  跳过不存在: ${src}`);
    return;
  }

  if (s.isDirectory()) {
    mkdirSync(dest, { recursive: true });
    const files = require('fs').readdirSync(src);
    for (const file of files) {
      if (file === 'node_modules' || file === '.git') continue;
      copyRecursive(join(src, file), join(dest, file));
    }
  } else {
    copyFileSync(src, dest);
  }
}

