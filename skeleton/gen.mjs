/**
 * Generate Typert artifacts for every host package that exports `./typert`.
 * Run AFTER `tsc -p packages/<pkg>`: the analyzer reads compiled d.ts entries.
 *
 * NOTE: replace /ABS/PATH/TO/deepseek-harness with the local dsh checkout path
 * (or add the published generator as a devDependency).
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { WorkspaceTypertGenerator } from '/ABS/PATH/TO/deepseek-harness/packages/typert/generator/lib/types/workspace.js'

const root = dirname(fileURLToPath(import.meta.url))
const generator = new WorkspaceTypertGenerator(root)

// Auto-discover host packages: any package dir whose manifest exports ./typert.
const packages = readdirSync(join(root, 'packages'))
  .filter(name => name !== 'vendor-typert-protocol')
  .filter(name => {
    try {
      const manifest = JSON.parse(readFileSync(join(root, 'packages', name, 'package.json'), 'utf8'))
      return manifest.exports?.['./typert'] !== undefined
    } catch { return false }
  })

for (const pkg of packages) {
  const artifacts = generator.generate([pkg], ['host'])
  for (const artifact of artifacts) {
    const output = join(root, artifact.packageRoot, 'lib')
    mkdirSync(output, { recursive: true })
    writeFileSync(join(output, `typert.${artifact.face}.js`), artifact.js)
    writeFileSync(join(output, `typert.${artifact.face}.d.ts`), artifact.dts)
    if (artifact.remote !== undefined) {
      writeFileSync(join(output, 'typert.remote-client.js'), artifact.remote.js)
      writeFileSync(join(output, 'typert.remote-client.d.ts'), artifact.remote.dts)
      writeFileSync(join(output, 'typert.remote-client.d.ts.map'), artifact.remote.dtsMap)
    }
    console.log(`emitted ${artifact.package} (face ${artifact.face}) ->`, output)
  }
}
