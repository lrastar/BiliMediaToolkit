import { spawn, execSync } from 'node:child_process';
import { existsSync, mkdirSync, createWriteStream, readdirSync, renameSync, rmSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN_DIR = resolve(__dirname, '../../bin');
const FFMPEG_EXE = resolve(BIN_DIR, 'ffmpeg.exe');

let cachedPath = null;
let downloading = false;

const SOURCES = [
  {
    name: 'GitHub BtbN',
    url: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip'
  },
  {
    name: 'gyan.dev',
    url: 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip'
  }
];

export function checkFfmpeg() {
  const ffmpegPath = getFfmpegPath();
  try {
    const output = execSync(`"${ffmpegPath}" -version`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    const versionMatch = output.match(/ffmpeg version (\S+)/);
    const version = versionMatch ? versionMatch[1] : 'unknown';
    return { installed: true, path: ffmpegPath, version };
  } catch {
    return { installed: false, path: '', version: '' };
  }
}

export function getFfmpegPath() {
  if (cachedPath) return cachedPath;
  if (existsSync(FFMPEG_EXE)) {
    cachedPath = FFMPEG_EXE;
    return cachedPath;
  }
  cachedPath = 'ffmpeg';
  return cachedPath;
}

export async function ensureFfmpeg() {
  const status = checkFfmpeg();
  if (status.installed) return true;
  if (downloading) {
    while (downloading) {
      await new Promise(r => setTimeout(r, 500));
    }
    return checkFfmpeg().installed;
  }
  try {
    await downloadFfmpeg();
    return true;
  } catch (err) {
    console.error('[ffmpeg] auto-download failed:', err.message);
    return false;
  }
}

export async function downloadFfmpeg() {
  if (downloading) return FFMPEG_EXE;
  downloading = true;

  try {
    if (!existsSync(BIN_DIR)) {
      mkdirSync(BIN_DIR, { recursive: true });
    }

    let lastError = null;
    for (const source of SOURCES) {
      try {
        console.log(`[ffmpeg] downloading from ${source.name}...`);
        const zipPath = resolve(BIN_DIR, 'ffmpeg.zip');

        const res = await fetch(source.url, { redirect: 'follow' });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
        let downloaded = 0;
        const startTime = Date.now();

        const fileStream = createWriteStream(zipPath);
        const reader = res.body.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fileStream.write(value);
          downloaded += value.length;

          if (contentLength > 0) {
            const percent = Math.round((downloaded / contentLength) * 100);
            const elapsed = (Date.now() - startTime) / 1000;
            const speed = (downloaded / elapsed / 1024 / 1024).toFixed(1);
            process.stdout.write(`\r[ffmpeg] ${percent}% (${speed} MB/s)`);
          }
        }

        fileStream.end();
        await new Promise(r => fileStream.on('finish', r));
        console.log('\n[ffmpeg] download complete, extracting...');

        execSync(
          `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${BIN_DIR}' -Force"`,
          { stdio: 'ignore' }
        );

        const extracted = readdirSync(BIN_DIR).find(f => f.startsWith('ffmpeg-') && !f.endsWith('.zip'));
        if (extracted) {
          const ffmpegBin = resolve(BIN_DIR, extracted, 'bin', 'ffmpeg.exe');
          if (existsSync(ffmpegBin)) {
            renameSync(ffmpegBin, FFMPEG_EXE);
          }
          const ffprobeBin = resolve(BIN_DIR, extracted, 'bin', 'ffprobe.exe');
          if (existsSync(ffprobeBin)) {
            renameSync(ffprobeBin, resolve(BIN_DIR, 'ffprobe.exe'));
          }
          rmSync(resolve(BIN_DIR, extracted), { recursive: true, force: true });
        }

        if (existsSync(zipPath)) {
          unlinkSync(zipPath);
        }

        cachedPath = FFMPEG_EXE;
        console.log('[ffmpeg] installed successfully');
        return FFMPEG_EXE;
      } catch (err) {
        console.error(`[ffmpeg] ${source.name} failed: ${err.message}`);
        lastError = err;
      }
    }

    throw new Error(`All sources failed. Last error: ${lastError?.message}`);
  } finally {
    downloading = false;
  }
}

export function mergeDASH(videoPath, audioPath, outputPath) {
  return new Promise((resolve, reject) => {
    const ffmpeg = getFfmpegPath();
    const proc = spawn(ffmpeg, [
      '-i', videoPath,
      '-i', audioPath,
      '-c', 'copy',
      '-y',
      outputPath
    ]);

    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        reject(new Error(`ffmpeg merge failed (code ${code}): ${stderr.slice(-500)}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`ffmpeg spawn error: ${err.message}`));
    });
  });
}

export function convertAudio(inputPath, outputPath, format) {
  return new Promise((resolve, reject) => {
    const ffmpeg = getFfmpegPath();
    let args;

    switch (format) {
      case 'mp3':
        args = ['-i', inputPath, '-codec:a', 'libmp3lame', '-q:a', '2', '-y', outputPath];
        break;
      case 'flac':
        args = ['-i', inputPath, '-codec:a', 'flac', '-y', outputPath];
        break;
      case 'm4a':
        args = ['-i', inputPath, '-c', 'copy', '-y', outputPath];
        break;
      default:
        args = ['-i', inputPath, '-codec:a', 'libmp3lame', '-q:a', '2', '-y', outputPath];
    }

    const proc = spawn(ffmpeg, args);

    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        reject(new Error(`ffmpeg convert failed (code ${code}): ${stderr.slice(-500)}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`ffmpeg spawn error: ${err.message}`));
    });
  });
}

export function recordLiveStream(streamUrl, outputPath, onData) {
  const ffmpeg = getFfmpegPath();
  const proc = spawn(ffmpeg, [
    '-i', streamUrl,
    '-c', 'copy',
    '-y',
    outputPath
  ]);

  if (onData) {
    proc.stderr.on('data', (chunk) => {
      onData(chunk.toString());
    });
  }

  return proc;
}