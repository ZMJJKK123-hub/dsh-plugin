#!/usr/bin/env node
/**
 * Sync the in-tree @dsh-custom plugins into this standalone plugin workspace.
 *
 * The main checkout (../myself-deepseek-harness) runs the in-tree copies; this
 * workspace keeps the distributable @dsh-custom copies for pairing with the
 * original upstream tree. This script performs the mechanical transform:
 * tsconfig/tsdown references are re-pointed at the sibling checkout, and
 * workspace:* peer ranges become plain *, because this workspace is not a
 * member of the main pnpm workspace.
 *
 * Usage: node sync-from-checkout.mjs [--check]
 */
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = resolve(dirname(fileURLToPath(import.meta.url)))
/** The sibling checkout directory name on disk (it carries a -1.1 suffix). */
const CHECKOUT_DIR = 'myself-deepseek-harness-1.1'
const CHECKOUT = resolve(HERE, '..', CHECKOUT_DIR)
/** Every reference this workspace writes names the checkout by this prefix. */
const CHECKOUT_REF = `../${CHECKOUT_DIR}`

/** source (checkout-relative) → destination (this workspace relative) */
const PACKAGES = {
  'packages/git/git': 'packages/git',
  'packages/git/git-local': 'packages/git-local',
  'packages/git/tool-git': 'packages/tool-git',
  'packages/git/git-remote': 'packages/git-remote',
  'packages/git/checkpoint-watcher': 'packages/checkpoint-watcher',
  'packages/schedule/automations': 'packages/automations',
  'packages/schedule/automations-remote': 'packages/automations-remote',
  'packages/shell/cua-guard': 'packages/cua-guard',
  'packages/client/ui-git': 'packages/client/ui-git',
  'packages/client/ui-automations': 'packages/client/ui-automations',
  'packages/client/ui-theme-zai': 'packages/client/ui-theme-zai',
}

/** Paths worth carrying; everything else (node_modules, caches) stays behind. */
const COPY = ['src', 'tests', 'lib', 'package.json', 'tsconfig.json', 'tsdown.config.ts',
  'README.md', 'README.zh.md', 'README.i18n.yaml']

/** Resolve one path written in a checkout tsconfig to its checkout-relative target. */
function resolveCheckoutPath(ref) {
  const parts = ref.split('/')
  let ups = 0
  while (ups < parts.length && parts[ups] === '..') ups += 1
  const rest = parts.slice(ups).join('/')
  // A package lives at packages/<group>/<name>: three ups reach the checkout root,
  // two ups reach packages/.
  if (ups === 3) return rest
  if (ups === 2) return `packages/${rest}`
  throw new Error(`unsupported reference depth in "${ref}"`)
}

/**
 * How many levels up from a destination package dir to the Desktop root.
 * The tsconfig sits INSIDE the package dir, so a depth-2 path
 * (`packages/<name>`) needs three ups: package → packages → workspace → Desktop.
 */
function desktopPrefix(dest) {
  const depth = dest.split('/').length
  return '../'.repeat(depth + 1)
}

/** Rewrite every `"../.."`-style path inside a JSON-ish text file. */
function rewriteRefs(text, dest) {
  const prefix = desktopPrefix(dest)
  // Both quote styles: tsconfig paths are double-quoted JSON, tsdown imports
  // are single-quoted TypeScript.
  return text.replace(/(["'])(\.\.[^"']*)\1/g, (whole, quote, ref) => {
    try {
      return `${quote}${prefix}${CHECKOUT_REF.slice(3)}/${resolveCheckoutPath(ref)}${quote}`
    } catch {
      return whole
    }
  })
}

/**
 * Repair a previously synced package whose references still name a checkout
 * directory that no longer exists (the checkout was renamed to -1.1).
 */
async function repairCheckoutRefs(dest) {
  for (const file of ['tsconfig.json', 'tsdown.config.ts']) {
    const path = join(HERE, dest, file)
    if (!existsSync(path)) continue
    const text = await readFile(path, 'utf8')
    const repaired = text
      .replaceAll('myself-deepseek-harness/', `${CHECKOUT_DIR}/`)
      .replaceAll(`${CHECKOUT_DIR}-1.1/`, `${CHECKOUT_DIR}/`)
    if (repaired !== text) await writeFile(path, repaired)
  }
}

/** Strip build leakage from a copied source tree (keep hand-written declarations). */
async function pruneLeaks(root) {
  const walk = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) { await walk(path); continue }
      const isDeclaration = entry.name.endsWith('.d.ts')
      const isBuildOutput = /\.(js|js\.map|d\.ts\.map)$/.test(entry.name)
      if (!isBuildOutput && !isDeclaration) continue
      if (entry.name === 'css-modules.d.ts' || entry.name === 'use-sync-external-store.d.ts') continue
      // A declaration/build file is leakage only when a sibling source exists.
      const stem = path.replace(/\.(js\.map|d\.ts\.map|js|d\.ts)$/, '')
      if (existsSync(`${stem}.ts`) || existsSync(`${stem}.tsx`)) await rm(path)
    }
  }
  await walk(root)
}

async function syncPackage(source, dest, check) {
  const from = join(CHECKOUT, source)
  const to = join(HERE, dest)
  if (check) return
  await rm(to, { recursive: true, force: true })
  await mkdir(dirname(to), { recursive: true })
  for (const entry of COPY) {
    const src = join(from, entry)
    if (!existsSync(src)) continue
    await cp(src, join(to, entry), { recursive: true })
  }
  await pruneLeaks(join(to, 'src'))

  // package.json: drop workspace-only ranges and the checkout repository block.
  const pkgPath = join(to, 'package.json')
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8'))
  for (const field of ['peerDependencies', 'devDependencies', 'dependencies']) {
    if (!pkg[field]) continue
    for (const [name, range] of Object.entries(pkg[field])) {
      // @dsh-custom/* members live in THIS workspace and keep their link range;
      // every checkout package resolves by name (published upstream or the
      // sibling checkout's node_modules), so its range becomes plain *.
      if (name.startsWith('@dsh-custom/')) {
        if (range === '*') pkg[field][name] = 'workspace:*'
        continue
      }
      if (range === 'workspace:*' || range === 'workspace:^') pkg[field][name] = '*'
    }
  }
  if (pkg.repository?.directory) {
    pkg.repository = { type: 'git', url: 'git+https://github.com/ZMJJKK123-hub/dsh-plugin.git' }
  }
  await writeFile(pkgPath, `${JSON.stringify(pkg, undefined, 2)}\n`)

  // tsconfig.json / tsdown.config.ts: re-point every checkout reference.
  for (const file of ['tsconfig.json', 'tsdown.config.ts']) {
    const path = join(to, file)
    if (!existsSync(path)) continue
    const text = await readFile(path, 'utf8')
    const rewritten = file === 'tsdown.config.ts'
      // A client bundle imports the shared preset by sibling path, which has no
      // checkout-relative meaning here; point it at the checkout's copy.
      ? text.replace(
        /(['"])\.\.\/tsdown\.client\.ts\1/,
        `$1${desktopPrefix(dest)}${CHECKOUT_REF.slice(3)}/packages/client/tsdown.client.ts$1`,
      )
      : rewriteRefs(text, dest)
    await writeFile(path, rewritten)
  }
}

const check = process.argv.includes('--check')
if (!existsSync(CHECKOUT)) {
  console.error(`sync: the checkout was not found at ${CHECKOUT.split(sep).join('/')}`)
  process.exit(1)
}
for (const [source, dest] of Object.entries(PACKAGES)) {
  await syncPackage(source, dest, check)
  console.log(`sync: ${source} → ${dest}`)
}
if (!check) {
  const normalized = await normalizeWorkspaceRanges()
  console.log(`sync: normalized peer/dev ranges in ${normalized} package(s)`)
}
console.log(`sync: ${Object.keys(PACKAGES).length} package(s) ${check ? 'checked' : 'synced'}`)

/**
 * Keep every package's dependency ranges honest for THIS workspace:
 *   - @dsh-custom/* members live here, so they must link (`workspace:*`);
 *   - @deepseek-ai/* members do not, so they resolve by name (`*`).
 * The two rules drift independently as packages are added by hand.
 */
async function normalizeWorkspaceRanges() {
  const roots = ['packages', 'packages/client']
  let touched = 0
  for (const root of roots) {
    for (const entry of await readdir(join(HERE, root), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const path = join(HERE, root, entry.name, 'package.json')
      if (!existsSync(path)) continue
      const pkg = JSON.parse(await readFile(path, 'utf8'))
      let changed = false
      for (const field of ['peerDependencies', 'devDependencies', 'dependencies']) {
        if (!pkg[field]) continue
        for (const [name, range] of Object.entries(pkg[field])) {
          if (name.startsWith('@dsh-custom/') && range !== 'workspace:*') {
            pkg[field][name] = 'workspace:*'
            changed = true
          } else if (name.startsWith('@deepseek-ai/') && range !== '*') {
            pkg[field][name] = '*'
            changed = true
          }
        }
      }
      if (!changed) continue
      await writeFile(path, `${JSON.stringify(pkg, undefined, 2)}
`)
      touched += 1
    }
  }
  return touched
}
