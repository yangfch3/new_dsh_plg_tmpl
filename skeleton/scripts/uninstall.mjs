#!/usr/bin/env node
/**
 * Uninstall the workspace's plugin packages from a dsh profile.
 *
 * Removes package symlinks and the loader rows (exact text block) added by
 * install.mjs; unrelated user edits are preserved, and a patch that only held
 * our rows is restored to the template `[]`. Idempotent.
 *
 * Usage: node scripts/uninstall.mjs [--profile <name>]   (default: web)
 */
import { existsSync, lstatSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const home = process.env.HOME ?? ''
const dshHome = process.env.DSH_HOME ?? join(home, '.dsh')
const profileArg = process.argv.indexOf('--profile')
const profile = profileArg >= 0 ? process.argv[profileArg + 1] : 'web'

// Keep in sync with install.mjs discovery; block text must match exactly.
const PACKAGES = ['dsh-hello-plugin', 'dsh-hello-plugin-ui']
const PATCH_BLOCK = `- insert:
${PACKAGES.map(pkg => `    - id: ${pkg.replace(/^dsh-/, '')}
      name: ${pkg}`).join('\n')}
`

// ── 1. Remove symlinks ──────────────────────────────────────────────────────
const fallbackDir = join(dshHome, 'profiles', 'node_modules')
for (const pkg of PACKAGES) {
  const link = join(fallbackDir, pkg)
  const stat = lstatSync(link, { throwIfNoEntry: false })
  if (stat === undefined) continue
  if (!stat.isSymbolicLink()) {
    console.error(`uninstall: ${link} is not a symlink — left untouched`)
    continue
  }
  rmSync(link)
  console.log(`removed link ${pkg}`)
}

// ── 2. Remove patch rows ────────────────────────────────────────────────────
const patchPath = join(dshHome, 'profiles', profile, 'cordis.patch.yml')
if (!existsSync(patchPath)) {
  console.log(`no patch file: ${patchPath} (nothing to do)`)
} else {
  const original = readFileSync(patchPath, 'utf8')
  const blockIndex = original.indexOf(PATCH_BLOCK)
  if (blockIndex < 0) {
    console.log(`patch contains no matching rows: ${patchPath} (skipped)`)
  } else {
    const without = original.replace(PATCH_BLOCK, '').trimEnd()
    const hasContent = without.split('\n').some(line => line.trim().length > 0 && !line.trim().startsWith('#'))
    const next = hasContent ? `${without}\n` : '[]\n'
    writeFileSync(patchPath, next, 'utf8')
    console.log(`removed loader rows from ${patchPath}`)
  }
}

console.log('\nUninstall done. Restart dsh web to apply.')
