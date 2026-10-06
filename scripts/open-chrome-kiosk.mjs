import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';

const url = process.argv[2] || process.env.KIOSK_URL || 'https://intradacredenciamentos.com.br/';
const profilePath = path.resolve('.chrome-kiosk-profile');

const chromeCandidates = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    `${process.env.HOME || ''}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
  ],
  win32: [
    `${process.env.PROGRAMFILES || ''}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env['PROGRAMFILES(X86)'] || ''}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env.LOCALAPPDATA || ''}\\Google\\Chrome\\Application\\chrome.exe`,
  ],
  linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium'],
};

const chromePath = chromeCandidates[process.platform]?.find((candidate) => existsSync(candidate));

if (!chromePath) {
  console.error('Google Chrome não encontrado. Instale-o ou abra manualmente com --kiosk-printing.');
  process.exit(1);
}

const chrome = spawn(
  chromePath,
  [
    '--kiosk-printing',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${profilePath}`,
    url,
  ],
  {
    detached: true,
    stdio: 'ignore',
  },
);

chrome.unref();
console.log(`Chrome aberto para impressão automática em ${url}`);
