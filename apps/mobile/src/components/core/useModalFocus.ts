import { useEffect, useRef, type MutableRefObject } from 'react'
import { Platform, type View } from 'react-native'

/**
 * Focus management for modal layers (REQ-043, ADR-0062). When a modal panel opens
 * on web, keyboard focus must move *into* it so Tab starts inside the dialog rather
 * than on the covered page. Attach the returned ref to the panel `View` and give it
 * `tabIndex={-1}` (react-native-web passes it through) so it is programmatically
 * focusable. A no-op on native, where `accessibilityViewIsModal` on the same panel
 * already scopes the screen reader to it.
 */
export function useModalFocus(open: boolean): MutableRefObject<View | null> {
  const ref = useRef<View | null>(null)
  useEffect(() => {
    if (!open || Platform.OS !== 'web' || typeof requestAnimationFrame !== 'function') {
      return undefined
    }
    const id = requestAnimationFrame(() => {
      // On web the RN View ref is a DOM element; focus() exists there and only there.
      const node = ref.current as unknown as { focus?: () => void } | null
      node?.focus?.()
    })
    return () => {
      cancelAnimationFrame(id)
    }
  }, [open])
  return ref
}
