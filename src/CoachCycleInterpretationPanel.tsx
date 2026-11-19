import type { CoachGeneratedSheetInterpretation } from './lib/coach-sheet-interpret-generated'
import type { CoachSheetSetGroup } from './lib/coach-sheet-interpret'
import type { CoachCycleDestinationIssue } from './lib/coach-cycle-destination'
import './coach-cycle-interpretation-panel.css'

function doseLabel(group: CoachSheetSetGroup): string {
  const dose = group.dose
  if (dose.kind === 'reps') return `${dose.min}${dose.max === dose.min ? '' : `–${dose.max}`} reps`
  if (dose.kind === 'amrap') return dose.min === null ? 'AMRAP' : `AMRAP · at least ${dose.min} reps`
  return `${dose.value} ${dose.unit}`
}

function loadLabel(group: CoachSheetSetGroup): string {
  const load = group.load
  if (load.kind === 'optional') return 'Athlete may enter weight'
  if (load.kind === 'none') return 'No weight field'
  if (load.kind === 'bodyweight') return 'Bodyweight'
  if (load.kind === 'qualitative') return `Effort ${load.value}`
  if (load.kind === 'percentage') return `${load.percent}% · needs max review`
  return `${load.weight} ${load.unit}${load.unitSource === 'cycle' ? ' · cycle unit' : ''}`
}

/** Read-only athlete preview. Publication requires a separately verified server receipt. */
export function CoachCycleInterpretationPanel({ result, destinationIssues = [] }: { result: CoachGeneratedSheetInterpretation; destinationIssues?: CoachCycleDestinationIssue[] }) {
  const issues = [...result.issues, ...destinationIssues]
  return <section className="cycle-review" aria-label="Cycle interpretation review">
    <div className="cycle-review-head">
      <div><p className="cycle-review-kicker">INTERPRETATION REVIEW</p><h2>What the athlete would receive</h2></div>
      <p role="status">{issues.length ? `${issues.length} issue${issues.length === 1 ? '' : 's'} to fix before publishing` : `${result.totals.groups} set groups · ${result.totals.sets} physical sets ready for final review`}</p>
    </div>
    {issues.length > 0 && <div className="cycle-review-issues" role="alert"><h3>Needs coach attention</h3><ol>{issues.map((issue, index) => <li key={`${issue.source?.sheetId ?? 'cycle'}:${issue.source?.address ?? 'general'}:${issue.code}:${index}`}><strong>{issue.source?.address ?? 'Cycle'}</strong><span>{issue.message}</span></li>)}</ol></div>}
    <div className="cycle-review-days">{result.days.map(day => <section key={day.id} aria-label={`${day.name} interpretation`}><h3>{day.name}</h3>{day.exercises.map(exercise => <div className="cycle-review-exercise" key={exercise.id}><div className="cycle-review-exercise-head"><strong>{exercise.name || 'Unnamed exercise'}</strong><small>Source {exercise.nameSource.address}</small></div><div className="cycle-review-weeks">{exercise.weeks.map(week => <div key={week.id} className="cycle-review-week"><div className="cycle-review-week-label"><strong>W{week.week}</strong><small>{week.prescription.groups[0]?.source?.address ?? week.prescription.issues[0]?.source?.address ?? ''}</small></div>{week.prescription.status === 'skipped' ? <p>Skipped</p> : week.prescription.groups.length ? <ol>{week.prescription.groups.map(group => <li key={`${group.position}:${group.start}`}><span>{group.count} × {doseLabel(group)}</span><span>{loadLabel(group)}</span>{group.rpe && <span>RPE {group.rpe.min}{group.rpe.max === group.rpe.min ? '' : `–${group.rpe.max}`}</span>}{group.laterality === 'each_side' && <span>Per side</span>}</li>)}</ol> : <p className="cycle-review-unresolved">{week.prescription.raw.trim() || 'Blank prescription'}</p>}{week.instructions.trim() && <p className="cycle-review-instruction"><b>Coach instruction:</b> {week.instructions}</p>}</div>)}</div></div>)}</section>)}</div>
  </section>
}
