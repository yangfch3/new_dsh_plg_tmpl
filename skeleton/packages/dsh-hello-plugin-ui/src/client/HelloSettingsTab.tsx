import { useEffect, useState, type ReactNode } from 'react'
import type { HelloSnapshot } from 'dsh-hello-plugin/types'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'

export interface HelloSettingsTabInjected {
  snapshot: () => Promise<HelloSnapshot>
}

export type HelloSettingsTabProps =
  PropsRuntime<'settings.plugins.tab'>
  & PropsLocale<'settings.hello'>
  & InjectFace<HelloSettingsTabInjected>

type ViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly detail: string | null }
  | { readonly status: 'ready'; readonly snapshot: HelloSnapshot }

export function HelloSettingsTab({ snapshot, t }: HelloSettingsTabProps): ReactNode {
  const [request, setRequest] = useState(0)
  const [state, setState] = useState<ViewState>({ status: 'loading' })

  useEffect(() => {
    let current = true
    void Promise.resolve().then(() => snapshot()).then(
      (value) => { if (current) setState({ status: 'ready', snapshot: value }) },
      (error) => {
        if (current) setState({ status: 'error', detail: String(error instanceof Error ? error.message : error) })
      },
    )
    return () => { current = false }
  }, [snapshot, request])

  const retry = (): void => { setState({ status: 'loading' }); setRequest(v => v + 1) }

  return (
    <div aria-busy={state.status === 'loading'}>
      {state.status === 'loading' ? <p>{t('loading')}</p> : null}
      {state.status === 'error' ? (
        <div>
          <p role="alert">{t('error')}</p>
          {state.detail !== null ? <p role="alert">{state.detail}</p> : null}
          <button type="button" onClick={retry}>{t('retry')}</button>
        </div>
      ) : null}
      {state.status === 'ready' && state.snapshot.records.length === 0 ? <p>{t('empty')}</p> : null}
      {state.status === 'ready' && state.snapshot.records.length > 0 ? (
        <ul>
          {state.snapshot.records.map(record => <li key={record.id}>{record.message}</li>)}
        </ul>
      ) : null}
    </div>
  )
}
