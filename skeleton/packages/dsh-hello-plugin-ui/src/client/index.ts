/**
 * Browser plugin skeleton: mounts the host's Remote contribution and
 * registers a Settings tab.
 *
 * CONTRACT NOTES (see ../docs/pitfalls.md):
 * - Mount the Remote in `apply` (awaited) BEFORE registering slots — an
 *   effect-scoped mount races the tab's first render.
 * - Do NOT inject the namespace service you mount yourself (self-inject
 *   deadlocks: the fiber waits for a service only it can provide). Read it
 *   with `ctx.get('remote.<ns>')`.
 */

import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { TYPERT_REMOTE } from 'dsh-hello-plugin/remote'
import type { HelloSnapshot } from 'dsh-hello-plugin/types'
import { HelloSettingsTab, type HelloSettingsTabInjected } from './HelloSettingsTab.tsx'
import { en, zh, type HelloLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.hello': HelloLocaleKey
  }
}

export const NS = 'settings.hello'

/** Services required by the Settings registration. */
export const inject = ['slots', 'locale', 'remote']

/** The namespace service this plugin mounts itself — fetched via ctx.get. */
interface HelloNamespace {
  snapshot(): Promise<RemoteResult<HelloSnapshot>>
}

export async function apply(ctx: ClientContext): Promise<void> {
  const disposeMount = await ctx.remote.$mount(TYPERT_REMOTE)
  ctx.effect(() => () => disposeMount(), 'ui: remote mount')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui: dictionaries')

  const t = ctx.locale.bind(NS)
  const hello = (): HelloNamespace => {
    const ns = ctx.get('remote.hello') as HelloNamespace | undefined
    if (ns === undefined) throw new Error('hello namespace service is not mounted')
    return ns
  }
  const injected = (): HelloSettingsTabInjected => ({
    snapshot: async () => {
      const result = await hello().snapshot()
      if (!result.ok) throw new Error(`hello.snapshot failed: ${result.error.code}: ${result.error.message}`)
      return result.value
    },
  })

  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'hello',
    order: 50,
    label: () => t('tab'),
    locale: NS,
    inject: injected,
  }, HelloSettingsTab))
}
