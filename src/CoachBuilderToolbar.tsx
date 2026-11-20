import type { RefObject } from 'react'
import type { CoachSheetActions, CoachSheetToolbarState } from './review/CoachSheetEditorProof'
import { percentConversionLabel } from './lib/coach-percent-resolution'
import type { BuilderStatus } from './lib/cycle-send-state'
import './coach-builder.css'

export type { BuilderStatus } from './lib/cycle-send-state'

export function CoachBuilderToolbar({ sheet, state, status, sendChanges, busy, saveBlocked, onLibrary, onStatus, drawerOpen, onCopy }: {
  sheet: RefObject<CoachSheetActions | null>
  state: CoachSheetToolbarState | null
  status?: BuilderStatus
  sendChanges?: boolean
  busy: boolean
  saveBlocked: boolean
  onLibrary?: () => void
  onStatus(): void
  drawerOpen: boolean
  onCopy?: () => void
}) {
  const working = busy || state?.saving || state?.publishing
  const copyMode = Boolean(onCopy)
  return <div className="ccb-toolbar" role="group" aria-label="Builder actions">
    <div className="ccb-tool-group">
      <button type="button" aria-expanded={Boolean(state?.settingsOpen)} disabled={!state || copyMode || working} onClick={() => sheet.current?.openSettings()}>Cycle settings</button>
      {onLibrary && <button type="button" disabled={working} onClick={onLibrary}>Library</button>}
    </div>
    {Boolean(state?.days.length) && <div className="ccb-tool-group" role="group" aria-label="Go to day">
      <span>Go to</span>{state?.days.map((day, index) => <button key={day} type="button" aria-label={day} onClick={() => sheet.current?.jumpToDay(index)}>{day.slice(0, 3)}</button>)}
    </div>}
    <div className="ccb-tool-group" role="group" aria-label="Spreadsheet zoom">
      <button type="button" aria-label="Zoom out" disabled={!state || state.zoom <= 50} onClick={() => sheet.current?.zoom(-1)}>−</button>
      <span>{state ? `${state.zoom}%` : '—'}</span>
      <button type="button" aria-label="Zoom in" disabled={!state || state.zoom >= 150} onClick={() => sheet.current?.zoom(1)}>+</button>
    </div>
    <div className="ccb-tool-group">
      <button type="button" aria-pressed={Boolean(state?.pastWeightsOpen && state.selectedExercise)} disabled={!state?.selectedExercise}
        title={state?.selectedExercise || 'Select an exercise'} onClick={() => sheet.current?.openPastWeights()}>Previous weights</button>
      <button type="button" disabled={copyMode || working || !state?.hasPercentCells} onClick={() => sheet.current?.openConvert()}>{percentConversionLabel(state?.unit ?? 'lb')}</button>
    </div>
    <div className="ccb-tool-group ccb-tool-end">
      {onCopy ? <button type="button" className="ccb-primary" disabled={working} onClick={onCopy}>Use as start for next cycle</button> : <>
        {status && <button type="button" className={`ccb-status ccb-status-${status.kind}`} title="Send details" aria-live="polite" aria-expanded={drawerOpen} onClick={onStatus}>
          <b>{status.title}</b>{status.detail && <small>{status.detail}</small>}
        </button>}
        <button type="button" disabled={!state || working || saveBlocked} onClick={() => void sheet.current?.save()}>{state?.saving ? 'Saving…' : 'Save'}</button>
        <button type="button" className="ccb-primary" disabled={!state?.canPublish || working || saveBlocked}
          title={state?.publishBlocked ? 'Fix the highlighted cells to send' : undefined}
          onClick={() => void sheet.current?.publish()}>{state?.publishing ? 'Sending…' : sendChanges ? 'Send changes' : 'Send to phone'}</button>
      </>}
    </div>
  </div>
}
