// Launch Chrome with this extension pre-loaded — no manual chrome://extensions.
//
// Regular Chrome (137+) disabled the --load-extension command-line flag, so we
// use Chrome for Testing (Google's automation build, which still honors it).
// It is downloaded once into ./.cache/ and reused afterwards.
//
//   npm run dev                 # blank tab
//   npm run dev -- https://mail.google.com
import {
  install,
  getInstalledBrowsers,
  computeExecutablePath,
  resolveBuildId,
  detectBrowserPlatform,
  Browser,
} from '@puppeteer/browsers';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionDir = dirname(dirname(fileURLToPath(import.meta.url)));
const cacheDir = join(extensionDir, '.cache');

async function ensureChromeForTesting() {
  const platform = detectBrowserPlatform();
  if (!platform)
    throw new Error('Unsupported platform for Chrome for Testing.');

  const existing = await getInstalledBrowsers({ cacheDir });
  const found = existing.find((b) => b.browser === Browser.CHROME);
  if (found) return found.executablePath;

  const buildId = await resolveBuildId(Browser.CHROME, platform, 'stable');
  console.log(`Downloading Chrome for Testing ${buildId} (one-time)…`);
  await install({
    browser: Browser.CHROME,
    buildId,
    cacheDir,
    downloadProgressCallback: (done, total) => {
      const pct = Math.round((done / total) * 100);
      process.stdout.write(`\r  ${pct}%   `);
    },
  });
  process.stdout.write('\n');
  return computeExecutablePath({ browser: Browser.CHROME, buildId, cacheDir });
}

const executablePath = await ensureChromeForTesting();
const profileDir = mkdtempSync(join(tmpdir(), 'print-clean-dev-'));
const urls = process.argv.slice(2);

const args = [
  `--user-data-dir=${profileDir}`,
  `--load-extension=${extensionDir}`,
  `--disable-extensions-except=${extensionDir}`,
  '--no-first-run',
  '--no-default-browser-check',
  ...urls,
];

console.log(`\nLaunching: ${executablePath}`);
console.log(`Extension: ${extensionDir}`);
console.log('Open the puzzle-piece menu to pin Print Clean. Close to stop.\n');

const child = spawn(executablePath, args, { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 0));
