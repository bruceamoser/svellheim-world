#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('node:fs');
const path = require('node:path');

const archiver = require('archiver');

// Paths are relative to the script location so dist output always lands
// under dist/ regardless of cwd.
const SCRIPT_DIR = __dirname;
const MODULE_PKG_ROOT = path.resolve(SCRIPT_DIR, '..');
const REPO_ROOT = process.cwd();

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, obj) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

async function zipDirectory({ srcDir, zipPath, folderInZip, exclude, fileOverrides }) {
  fs.mkdirSync(path.dirname(zipPath), { recursive: true });

  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  const finish = new Promise((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
  });

  archive.pipe(output);

  archive.directory(srcDir, folderInZip, (entry) => {
    const rel = entry.name.replace(/\\/g, '/');
    if (exclude && exclude.some((re) => re.test(rel))) return false;
    if (fileOverrides && fileOverrides[rel]) return false;
    return entry;
  });

  // Add overridden files (e.g. stamped module.json)
  if (fileOverrides) {
    for (const [rel, content] of Object.entries(fileOverrides)) {
      archive.append(content, { name: `${folderInZip}/${rel}` });
    }
  }

  await archive.finalize();
  await finish;
}

async function main() {
  const args = parseArgs(process.argv);

  // Default module dir is the 'module' subfolder next to the tools/ dir.
  const moduleDir = args.module
    ? path.resolve(REPO_ROOT, args.module)
    : path.join(MODULE_PKG_ROOT, 'module');
  const moduleJsonPath = path.join(moduleDir, 'module.json');

  if (!fs.existsSync(moduleJsonPath)) {
    console.error(`Missing module.json at: ${moduleJsonPath}`);
    process.exit(2);
  }

  const mod = readJson(moduleJsonPath);

  const version = args.version || mod.version;
  if (!version) {
    console.error('module.json is missing a version field (or pass --version).');
    process.exit(2);
  }

  const moduleId = mod.id || path.basename(moduleDir);
  const tag = args.tag || `v${version}`;
  const zipBaseName = args.zip || `${moduleId}-v${version}.zip`;

  // Always output into dist/foundry/
  const distDir = path.join(MODULE_PKG_ROOT, 'dist', 'foundry');
  const zipOutPath = path.join(distDir, zipBaseName);
  const manifestOutPath = path.join(distDir, 'module.json');

  // Derive the release repo from the existing manifest/url fields in module.json
  // so we don't override the correct repo with a hardcoded default.
  // Falls back to --repo arg or the module's url field.
  const repoFromUrl = (mod.url || '').replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
  const repo = args.repo || repoFromUrl || 'bruceamoser/svellheim-world';

  // Update manifest and download URLs, stamping the current version into the
  // download path while preserving the correct repo.
  const manifestUrl = `https://github.com/${repo}/releases/latest/download/module.json`;
  const downloadUrl = `https://github.com/${repo}/releases/download/${tag}/${zipBaseName}`;
  const projectUrl = `https://github.com/${repo}`;

  // Ensure the manifest fields are present in the emitted manifest.
  const emitted = {
    ...mod,
    version,
    url: mod.url || projectUrl,
    manifest: manifestUrl,
    download: downloadUrl,
  };

  writeJson(manifestOutPath, emitted);

  // Build zip that contains the module folder at root.
  // The folder inside the zip MUST match the Foundry module ID, not the local
  // disk folder name, so that Foundry installs it into the correct path.
  const exclude = [
    new RegExp(`^${moduleId}/_extracted-json/`),
    new RegExp(`^${moduleId}/\\.DS_Store$`),
  ];

  await zipDirectory({
    srcDir: moduleDir,
    zipPath: zipOutPath,
    folderInZip: moduleId,
    exclude,
    fileOverrides: {
      'module.json': JSON.stringify(emitted, null, 2) + '\n',
    },
  });

  console.log(`Wrote manifest: ${path.relative(REPO_ROOT, manifestOutPath) || manifestOutPath}`);
  console.log(`Wrote zip: ${path.relative(REPO_ROOT, zipOutPath) || zipOutPath}`);
  console.log('Upload BOTH files to the GitHub Release assets.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
