import { useId, useState, type CSSProperties } from 'react'
import { ModalDialog } from './ModalDialog'
import { rewritePercentPrescription, type PercentLoad } from './lib/coach-percent-resolution'
import type { CoachWeightUnit } from './lib/coach-sheet-interpret'

export type PercentCell = {
  row: number
  column: number
  day: string
  exercise: string
  week: number
  raw: string
} & ({ loads: PercentLoad[] } | { reason: 'no max found' | 'workout is locked' })

export type PercentConversion = Pick<PercentCell, 'row' | 'column'> & { text: string }
export type PercentConversionRequest = {
  cells: PercentCell[]
  unit: CoachWeightUnit
  legacyCopy?: boolean
  apply(conversions: PercentConversion[]): void
}

const tableCell: CSSProperties = { textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
const loadIsValid = (value: string) => /^\d+(?:\.\d{1,3})?$/.test(value) && Number(value) > 0 && Number(value) <= 9_999_999.999
const location = (cell: PercentCell) => `${cell.day} · ${cell.exercise} · W${cell.week}`
const withWeights = (loads: PercentLoad[], weights: string[]) => loads.map((load, i) => ({ ...load, weight: Number(weights[i]) }))

export function CoachConvertPercentDialog({ cells, unit, legacyCopy = false, apply, onClose }: PercentConversionRequest & { onClose(): void }) {
  const titleId = useId()
  const [rows, setRows] = useState(() => cells.flatMap(cell => 'loads' in cell
    ? [{ cell, include: true, weights: cell.loads.map(load => String(load.weight)) }] : []))
  const left = cells.filter(cell => 'reason' in cell)
  const nothingToConvert = !legacyCopy && rows.length === 0
  const leftDetails = [...new Set(left.map(cell => legacyCopy ? `${location(cell)}: ${cell.reason}`
    : cell.reason === 'workout is locked' ? `W${cell.week} is already done and stays as it is`
    : `${cell.exercise}${nothingToConvert ? '' : ` · W${cell.week}`} needs a max`))]
  const included = rows.filter(row => row.include)
  const invalid = included.some(row => !row.weights.every(loadIsValid))
  const update = (index: number, change: Partial<(typeof rows)[number]>) => {
    setRows(current => current.map((row, i) => i === index ? { ...row, ...change } : row))
  }

  return <ModalDialog className="modal-backdrop" labelledBy={titleId} onEscape={onClose} onBackdropClick={onClose}>
    <div className="dialog" style={{ width: 'min(920px, 100%)', maxHeight: 'calc(100dvh - 40px)', overflow: 'auto' }}>
      <h2 id={titleId}>Convert % to {unit}</h2>
      {rows.length > 0 && <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{['Include', 'Exercise', 'Day', 'Week', 'Now', `Becomes (${unit})`].map(heading =>
          <th scope="col" key={heading} style={tableCell}>{heading}</th>)}</tr></thead>
        <tbody>{rows.map(({ cell, weights, include }, index) => {
          const label = location(cell)
          const loads = withWeights(cell.loads, weights)
          return <tr key={`${cell.row}:${cell.column}`} style={{ color: include ? 'var(--text)' : 'var(--text-muted)' }}>
            <td style={tableCell}><input type="checkbox" aria-label={`Include ${label}`} checked={include}
              onChange={event => update(index, { include: event.target.checked })} /></td>
            <th scope="row" style={tableCell}>{cell.exercise}</th>
            <td style={tableCell}>{cell.day}</td><td style={tableCell}>W{cell.week}</td>
            <td style={{ ...tableCell, whiteSpace: 'pre-wrap' }}>{cell.raw}</td>
            <td style={tableCell}>
              {cell.loads.map((load, i) =>
                <label key={load.start} style={{ display: 'block', whiteSpace: 'nowrap' }}>
                  {load.percent}% → <input type="number" min="0.001" max="9999999.999" step="any" style={{ width: '6em' }}
                    aria-label={`${label} load ${i + 1} in ${unit}`} aria-invalid={include && !loadIsValid(weights[i])}
                    value={weights[i]} disabled={!include}
                    onChange={event => update(index, { weights: weights.map((weight, j) => i === j ? event.target.value : weight) })} /> {unit}
                </label>)}
              {weights.every(loadIsValid) && <div style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{rewritePercentPrescription(cell.raw, loads, unit)}</div>}
            </td>
          </tr>
        })}</tbody>
      </table>}
      {nothingToConvert
        ? <p>Nothing to convert yet{leftDetails.length > 0 && `: ${leftDetails.join('. ')}`}.</p>
        : leftDetails.length > 0 && <p>Left as %: {leftDetails.join(legacyCopy ? ', ' : '. ')}{!legacyCopy && '.'}</p>}
      {invalid && <p role="status">Use a load from 0.001 to 9,999,999.999 with up to three decimal places.</p>}
      <div className="dialog-actions">
        <button className="button outline" onClick={onClose}>{nothingToConvert ? 'Close' : 'Cancel'}</button>
        {!nothingToConvert && <button className="button primary" disabled={!included.length || invalid} onClick={() => apply(included.map(({ cell, weights }) => ({
          row: cell.row, column: cell.column,
          text: rewritePercentPrescription(cell.raw, withWeights(cell.loads, weights), unit),
        })))}>{included.length || legacyCopy ? `Convert ${included.length}` : 'Convert'}</button>}
      </div>
    </div>
  </ModalDialog>
}
