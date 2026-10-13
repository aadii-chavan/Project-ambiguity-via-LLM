import { fmtDate, scoreColor, ISSUE_META, SEVERITY_META } from './utils'

describe('utils', () => {
  it('colors scores by band', () => {
    expect(scoreColor(95)).toBe('#16a34a')
    expect(scoreColor(70)).toBe('#f5a524')
    expect(scoreColor(10)).toBe('#e5484d')
  })
  it('formats dates', () => expect(fmtDate('2026-10-13T09:30:00Z')).toMatch(/Oct 1[23], 2026/))
  it('has metadata for all 10 issue types and 3 severities', () => {
    expect(Object.keys(ISSUE_META)).toHaveLength(10)
    expect(Object.keys(SEVERITY_META)).toEqual(['high', 'medium', 'low'])
  })
})
