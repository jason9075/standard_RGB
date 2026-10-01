/** Copy native dependencies to an executable, private temporary directory. */
const { copyFileSync, chmodSync, existsSync, mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, basename, resolve } = require('node:path');

let directory;
const copies = new Map();
function executableCopy(source) {
  if (copies.has(source)) return copies.get(source);
  directory ??= mkdtempSync(join(tmpdir(), 'gfx-lab-'));
  const target = join(directory, `${copies.size}-${basename(source)}`);
  copyFileSync(source, target);
  chmodSync(target, 0o755);
  copies.set(source, target);
  return target;
}

const esbuildSource = resolve(__dirname,
  `../node_modules/@esbuild/${process.platform}-${process.arch}/bin/esbuild`);
if (existsSync(esbuildSource)) {
  process.env.ESBUILD_BINARY_PATH = executableCopy(esbuildSource);
}

const originalDlopen = process.dlopen.bind(process);
process.dlopen = function (module, filename, flags) {
  const target = filename.endsWith('.node') ? executableCopy(filename) : filename;
  return flags === undefined
    ? originalDlopen(module, target)
    : originalDlopen(module, target, flags);
};

process.once('exit', () => {
  if (directory) rmSync(directory, { recursive: true, force: true });
});
