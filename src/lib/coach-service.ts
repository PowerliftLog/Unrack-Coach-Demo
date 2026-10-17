export type Athlete = { id: string; name: string; initials: string; focus: string; status: 'Active' | 'Deload' | 'Check-in due' }

export type Exercise = { name: string; prescription: string; load: string; rpe: string; rest: string; note?: string }

export type TrainingDay = { name: string; date: string; focus: string; exercises: Exercise[] }

export type Program = { name: string; athlete: string; block: string; week: number; weeks: number[]; days: TrainingDay[] }

export const demoAthletes: Athlete[] = [
  { id: 'maya', name: 'Maya Chen', initials: 'MC', focus: 'Powerlifting · 63 kg', status: 'Active' },
  { id: 'marcus', name: 'Marcus Reed', initials: 'MR', focus: 'Strength base · 93 kg', status: 'Check-in due' },
  { id: 'sara', name: 'Sara Flores', initials: 'SF', focus: 'Powerbuilding · 72 kg', status: 'Active' },
  { id: 'devon', name: 'Devon Price', initials: 'DP', focus: 'Return to training', status: 'Deload' },
]

export const demoProgram: Program = {
  name: 'Fall Peak · 4 Week', athlete: 'Maya Chen', block: 'Strength / Week 2', week: 2, weeks: [1, 2, 3, 4],
  days: [
    { name: 'MON', date: 'Sep 7', focus: 'Competition squat', exercises: [
      { name: 'Low Bar Back Squat', prescription: '1 × 1 + 4 × 4', load: '145 kg', rpe: '8 / 7', rest: '4:00', note: 'Pause first rep' },
      { name: 'Paused Bench Press', prescription: '4 × 5', load: '72.5 kg', rpe: '7', rest: '3:00' },
      { name: 'Chest-Supported Row', prescription: '3 × 10', load: '45 kg', rpe: '8', rest: '2:00' },
    ] },
    { name: 'WED', date: 'Sep 9', focus: 'Competition bench', exercises: [
      { name: 'Competition Bench', prescription: '1 × 1 + 5 × 3', load: '80 kg', rpe: '8 / 7', rest: '4:00', note: 'Full pause, meet commands' },
      { name: 'Tempo Deadlift', prescription: '4 × 4', load: '150 kg', rpe: '6', rest: '3:00' },
      { name: 'Lat Pulldown', prescription: '3 × 12', load: '52 kg', rpe: '8', rest: '1:30' },
    ] },
    { name: 'FRI', date: 'Sep 11', focus: 'Competition deadlift', exercises: [
      { name: 'Competition Deadlift', prescription: '1 × 1 + 3 × 3', load: '175 kg', rpe: '8 / 7', rest: '5:00', note: 'Wedge and wait' },
      { name: 'High Bar Squat', prescription: '3 × 6', load: '112.5 kg', rpe: '6', rest: '3:00' },
      { name: 'DB Incline Press', prescription: '3 × 10', load: '24 kg', rpe: '8', rest: '2:00' },
    ] },
  ],
}

export interface CoachService {
  addAthlete(input: { name: string; focus: string }): Promise<void>
  saveProgram(program: Program): Promise<void>
  publishProgram(programId: string): Promise<void>
}

/**
 * Local-only placeholder: replace with authenticated Worker mutation calls, never direct browser RPC writes.
 * The production publish request must include the selected immutable source_token and the fresh builder_version
 * returned by its read model; a Worker must reject stale or cross-tenant requests before invoking Postgres.
 */
export const demoCoachService: CoachService = {
  addAthlete: async () => undefined,
  saveProgram: async () => undefined,
  publishProgram: async () => undefined,
}
