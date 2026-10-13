import { renderHook, act } from '@testing-library/react'
import { loadDefaults, useDefaults } from './settings'

beforeEach(() => localStorage.clear())

describe('settings defaults', () => {
  it('falls back safely on missing or corrupt storage', () => {
    expect(loadDefaults()).toEqual({ strictness: 'balanced', style: 'shall' })
    localStorage.setItem('reqclear.defaults', '{not json')
    expect(loadDefaults()).toEqual({ strictness: 'balanced', style: 'shall' })
    localStorage.setItem('reqclear.defaults', JSON.stringify({ strictness: 'evil', style: 'free' }))
    expect(loadDefaults()).toEqual({ strictness: 'balanced', style: 'free' })     // invalid value rejected, valid kept
  })
  it('persists updates', () => {
    const { result } = renderHook(() => useDefaults())
    act(() => result.current[1]({ strictness: 'strict' }))
    expect(result.current[0].strictness).toBe('strict')
    expect(loadDefaults().strictness).toBe('strict')
  })
})
