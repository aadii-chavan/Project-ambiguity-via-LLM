import { render, screen } from '@testing-library/react'
import { Trend } from './ui'

describe('Trend', () => {
  it('shows "No change" instead of a red/green arrow for ~0', () => {
    render(<Trend delta={0} />)
    expect(screen.getByText('No change')).toBeInTheDocument()
  })
  it('colors direction by whether down is good', () => {
    const { container, rerender } = render(<Trend delta={-5} goodWhenDown />)
    expect(container.firstElementChild).toHaveClass('text-positive')
    rerender(<Trend delta={-5} />)
    expect(container.firstElementChild).toHaveClass('text-negative')
  })
})
