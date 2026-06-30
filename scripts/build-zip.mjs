// Builds a publishable zip of the extension into dist/.
// No third-party deps — shells out to the system `zip`.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const FILES = [
  'manifest.json',
  'background.js',
  'printClean.js',
  'printPreview.js',
  'shared.js',
  'styles.css',
  'settings.html',
  'settings.js',
  'defaultSettings.json',
  'icon48.png',
  'icon128.png',
];

const { version } = JSON.parse(
  readFileSync(join(root, 'manifest.json'), 'utf8')
);
const outFile = join(dist, `print-clean-${version}.zip`);

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

execFileSync('zip', ['-j', outFile, ...FILES], { cwd: root, stdio: 'inherit' });

console.log(`\nCreated ${outFile}`);
