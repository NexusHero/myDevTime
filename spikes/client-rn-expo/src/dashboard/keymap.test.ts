import { describe, expect, it } from 'vitest'
import { moveFocus, resolve, type KeyEvent } from './keymap.js'

const k = (key: string, meta = false, shift = false): KeyEvent => ({ key, meta, shift })

describe('keyboard-first dashboard resolver', () => {
  it('List_NavigationAndRowActions', () => {
    expect(resolve(k('j'), 'list')).toBe('moveDown')
    expect(resolve(k('ArrowUp'), 'list')).toBe('moveUp')
    expect(resolve(k('n'), 'list')).toBe('newEntry')
    expect(resolve(k('e'), 'list')).toBe('editFocused')
    expect(resolve(k('Enter'), 'list')).toBe('editFocused')
    expect(resolve(k('/'), 'list')).toBe('openSearch')
    expect(resolve(k('Backspace', false, true), 'list')).toBe('deleteFocused')
  })

  it('Editing_CapturesTextButHandlesCommitChords', () => {
    expect(resolve(k('a'), 'editing')).toBe('none') // types normally
    expect(resolve(k('Enter'), 'editing')).toBe('save')
    expect(resolve(k('Enter', true), 'editing')).toBe('save')
    expect(resolve(k('Enter', false, true), 'editing')).toBe('none') // shift+enter = newline
    expect(resolve(k('Escape'), 'editing')).toBe('cancel')
  })

  it('Search_OnlyEscapeExits', () => {
    expect(resolve(k('j'), 'search')).toBe('none') // typing a query, not navigating
    expect(resolve(k('Escape'), 'search')).toBe('cancel')
  })

  it('MoveFocus_ClampsWithoutWrapping', () => {
    expect(moveFocus(0, -1, 5)).toBe(0)
    expect(moveFocus(4, 1, 5)).toBe(4)
    expect(moveFocus(2, 1, 5)).toBe(3)
    expect(moveFocus(0, 1, 0)).toBe(0) // empty list
  })
})
