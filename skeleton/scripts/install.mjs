#!/usr/bin/env node
/**
 * Install the workspace's plugin packages into a dsh profile.
 *
 * Auto-discovers packages under ./packages (excluding vendor-*), symlinks
 * them into $DSH_HOME/profiles/node_modules, and inserts one loader row per
 * package into $DSH_HOME/profiles/<name>/cordis.patch.yml. Idempotent;
 * patch edits are exact text blocks, so unrelated user edits are preserved.
 *
 * Usage: node scripts/install.mjs [--profile <name>]   (default: web)
 */
import {
  existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const home = process.env.HOME ?? ''
const dshHome = process.env.DSH_HOME ?? join(home, '.dsh')
const profileArg = process.argv.indexOf('--profile')
const profile = profileArg >= 0 ? process.argv[profileArg + 1] : 'web'

const PACKAGES = readdirSync(join(repoRoot, 'packages'))
  .filter(name => !name.startsWith('vendor-'))
  .filter(name => existsSync(join(repoRoot, 'packages', name, 'package.json')))
const PATCH_BLOCK = `- insert:
${PACKAGES.map(pkg => `    - id: ${pkg.replace(/^dsh-/, '')}
      name: ${pkg}`).join('\n')}
`

function fail(message) {
  console.error(`install: ${message}`)
  process.exit(1)
}

if (PACKAGES.length === 0) fail('no plugin packages found under ./packages')

// ── 0. Preconditions ────────────────────────────────────────────────────────
if (!existsSync(dshHome)) fail(`DSH_HOME not found: ${dshHome}`)
if (!existsSync(join(dshHome, 'profiles', profile))) {
  fail(`profile "${profile}" not found under ${dshHome}/profiles`)
}
// Built-artifact guard: linking an unbuilt package installs a dead symlink and
// the failure surfaces only at dsh startup. Fail here instead (see README build).
for (const pkg of PACKAGES) {
  const built = join(repoRoot, 'packages', pkg, 'lib')
  if (!existsSync(built)) {
    fail(`${pkg} is not built (missing ${built}); build first: tsc -p packages/${pkg} + gen.mjs / tsdown`)
  }
}

// ── 1. Symlink packages ─────────────────────────────────────────────────────
const fallbackDir = join(dshHome, 'profiles', 'node_modules')
mkdirSync(fallbackDir, { recursive: true })
for (const pkg of PACKAGES) {
  const link = join(fallbackDir, pkg)
  const target = join(repoRoot, 'packages', pkg)
  if (lstatSync(link, { throwIfNoEntry: false })?.isSymbolicLink() ?? false) {
    rmSync(link)
  } else if (existsSync(link)) {
    fail(`${link} exists and is not a symlink — remove it manually first`)
  }
  symlinkSync(target, link)
  console.log(`linked ${pkg} -> ${target}`)
}

// ── 2. Patch the profile ────────────────────────────────────────────────────
const patchPath = join(dshHome, 'profiles', profile, 'cordis.patch.yml')
const original = readFileSync(patchPath, 'utf8')
if (PACKAGES.some(pkg => original.includes(pkg))) {
  console.log(`patch already contains these packages: ${patchPath} (skipped)`)
} else {
  const trimmed = original.trimEnd()
  const isTemplate = trimmed === '[]'
  const next = isTemplate ? PATCH_BLOCK : `${trimmed}\n\n${PATCH_BLOCK}`
  writeFileSync(patchPath, next, 'utf8')
  console.log(`patched ${patchPath} with ${PACKAGES.length} loader rows`)
}

console.log('\nInstall done. Restart dsh web (profile HMR is off):')
console.log('  cd <deepseek-harness checkout> && pnpm dsh web')
