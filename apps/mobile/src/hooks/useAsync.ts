import { useEffect, useState } from 'react'

/**
 * A minimal async-resource hook (issue #11): run `fn` on mount (and when `key`
 * changes or `reload` is called), tracking loading / error / data so screens can
 * render the three states without a data-fetching library. A liveness flag drops
 * results from a superseded run, so a fast re-key can't clobber the latest data.
 */
export interface AsyncState<T> {
  readonly loading: boolean
  readonly error: Error | null
  readonly data: T | null
}

export interface AsyncResource<T> extends AsyncState<T> {
  readonly reload: () => void
}

export function useAsync<T>(fn: () => Promise<T>, key: string): AsyncResource<T> {
  const [state, setState] = useState<AsyncState<T>>({ loading: true, error: null, data: null })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let alive = true
    setState(prev => ({ loading: true, error: null, data: prev.data }))
    fn()
      .then(data => {
        if (alive) setState({ loading: false, error: null, data })
      })
      .catch((cause: unknown) => {
        if (alive) {
          setState({
            loading: false,
            error: cause instanceof Error ? cause : new Error(String(cause)),
            data: null,
          })
        }
      })
    return () => {
      alive = false
    }
    // `fn` is re-created each render; `key` + `nonce` are the real inputs.
  }, [key, nonce])

  return {
    ...state,
    reload: () => {
      setNonce(n => n + 1)
    },
  }
}
