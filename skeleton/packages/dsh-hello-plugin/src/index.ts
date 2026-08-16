/**
 * Host plugin skeleton.
 *
 * CONTRACT NOTES (see ../docs/pitfalls.md for the full list):
 * - NO default export: the loader's unwrapExports picks `exports.default`
 *   and would strip `Config` (and `apply`) off the module namespace.
 * - Remote method names must NOT collide with the client gateway's
 *   RemoteNamespaceService reserved names (remove/has/empty/name/...).
 * - `super(ctx, key)` requires a string literal key.
 */

import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import type { HelloSnapshot } from './types.ts'

export type * from './types.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'hello-plugin'

/** Plugin configuration supplied through cordis.yml (schema-validated). */
export interface Config {
  enabled: boolean
  sampleIntervalMs: number
}

export const Config: Schema<Config> = Schema.object({
  enabled: Schema.boolean().default(true),
  sampleIntervalMs: Schema.number().min(1000).default(10_000),
})

/**
 * The plugin service. `super(ctx, 'hello')` registers the service that the
 * host gateway dispatches Remote calls to; `@Remote('snapshot')` marks the
 * wire method (the generated `./remote` artifact describes it for clients).
 */
export class HelloGateway extends TypertRemoteService {
  constructor(ctx: Context, config: Config) {
    super(ctx, 'hello')
    void config
  }

  /** Read the current projection. */
  @Remote('snapshot')
  snapshot(): HelloSnapshot {
    return { records: [] }
  }
}

/**
 * Plugin entry: register the gateway service.
 * `workspaceRegistry`-style optional services: use `ctx.get(name)`, never
 * property access (inject guard) and never inject (web-only services).
 */
export function apply(ctx: Context, config: Config): void {
  if (!config.enabled) return
  new HelloGateway(ctx, config)
}
