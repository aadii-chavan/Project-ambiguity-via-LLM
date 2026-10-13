import { render, screen } from '@testing-library/react'
import { DiffView, HighlightedText } from './RequirementParts'
import type { Issue } from '@/types'

const issue = (span: string, start: number, type: Issue['type'] = 'vague_term'): Issue =>
  ({ type, severity: 'high', span, start, end: start + span.length, explanation: 'because' })

describe('HighlightedText', () => {
  it('wraps each issue span in <mark> and keeps the rest of the text', () => {
    const t = 'The system should respond quickly.'
    const { container } = render(<HighlightedText text={t} issues={[issue('quickly', 26), issue('should', 11, 'non_testable')]} />)
    const marks = [...container.querySelectorAll('mark')].map((m) => m.textContent)
    expect(marks).toEqual(['should', 'quickly'])
    expect(container.textContent).toBe(t)
  })
  it('skips overlapping issues instead of duplicating text', () => {
    const t = 'Support many users'
    const { container } = render(<HighlightedText text={t} issues={[issue('many users', 8), issue('many', 8)]} />)
    expect(container.textContent).toBe(t)
    expect(container.querySelectorAll('mark')).toHaveLength(1)
  })
  it('renders untrusted text as plain text (no HTML injection)', () => {
    const t = '<img src=x onerror=alert(1)> shall be fast'
    const { container } = render(<HighlightedText text={t} issues={[issue('fast', 36)]} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toBe(t)
  })
  it('works with no issues', () => {
    render(<HighlightedText text="All good." issues={[]} />)
    expect(screen.getByText('All good.')).toBeInTheDocument()
  })
})

describe('DiffView', () => {
  it('marks removed and added words', () => {
    const { container } = render(<DiffView before="The system should respond quickly" after="The system shall respond within 2 seconds" />)
    const text = (sel: string) => [...container.querySelectorAll(sel)].map((e) => e.textContent).join(' ')
    expect(text('del')).toMatch(/should/)
    expect(text('del')).toMatch(/quickly/)
    expect(text('ins')).toMatch(/shall/)
    expect(text('ins')).toMatch(/2 seconds/)
  })
})
