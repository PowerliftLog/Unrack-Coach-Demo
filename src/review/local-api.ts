import { createProgram, loadModel, options, type LocalModel, type LocalProgram } from './local-model'
import type { ComponentProps } from 'react'
import type ConnectedCoachApp from '../ConnectedCoachApp'
import type { RichProgramDayV2 } from '../lib/coach-api'

// This adapter is imported only in local review mode. No fetch, JWT, or Supabase client.
// Input shapes vary by production API version; this local boundary is deliberately
// separate from server validation and is not evidence of backend correctness.
type Input = Record<string, any>
const clone = <T,>(value:T):T => JSON.parse(JSON.stringify(value))
const now=()=>new Date().toISOString()
export function createLocalApi(storage: Pick<Storage,'getItem'|'setItem'>=localStorage) {
  const model: LocalModel=loadModel(storage)
  const persist=()=>storage.setItem('unrack-local-coach-workspace-v1',JSON.stringify(model))
  const find=(input:Input):LocalProgram=>{
    const found=model.athletes.find(a=>a.program?.detail.assignment_id===input.assignment || a.program?.detail.program_id===input.program)?.program
    if(!found) throw new Error('Choose a local sample program.')
    return found
  }
  const template=(input:Input)=>{const result=model.templates.find(t=>t.id===input.template);if(!result)throw new Error('Local template not found.');return result}
  const page=(items:unknown[],version=1)=>({contract_version:version,visibility_kind:'gym',server_as_of_date:now().slice(0,10),dashboard_read_token:{search_text:null},items,has_more:false,next_cursor:null,next_read_token:null})
  const assignment=(program:LocalProgram)=>({assignment_id:program.detail.assignment_id,program_id:program.detail.program_id,program_name:program.detail.program_name,program_status:program.detail.program_status,assignment_status:program.detail.assignment_status,assigned_at:now(),start_on:program.detail.calendar?.start_on,end_on:program.detail.weeks.at(-1)?.days.at(-1)?.planned_date,has_release:program.detail.program_status==='active',lifecycle_bucket:'current_active',archived_at:null,archive_generation:'1',archive_eligible:false,archive_blocker:'current_program'})
  const roster=(input:Input)=>page(model.athletes.filter(a=>input.group_kind==='current_clients'?a.program?.detail.program_status==='active':a.program?.detail.program_status!=='active').filter(a=>!input.search_text || a.name.toLowerCase().includes(input.search_text.toLowerCase())).map(a=>({athlete_id:a.id,roster_name:a.name,roster_status:'active',has_active_assignment:!!a.program,current_assignment_id:a.program?.detail.assignment_id ?? null,current_assignment_available:!!a.program,current_assignment:a.program?assignment(a.program):null,lifecycle_counts:{current_active:a.program?1:0,unreleased_draft:0,unreleased_future:0,historical_released:0,completed_or_revoked:0},future_or_draft_plan_count:0,program_readiness:a.program?.detail.authoring.readiness ?? null,programming_state:a.program?.detail.program_status==='active'?'current':'needs_programming'})),2)
  function updateDay(program:LocalProgram,day:RichProgramDayV2) {
    const previous=program.days[day.identity_token]
    function materialize(value: Input, originals: Input[]): Input {
      const old=originals.find(item=>item.identity_token===value.identity_token)
      if(value.mode==='preserve') {
        if(!old) throw new Error('The local preserved row is unavailable.')
        return clone(old)
      }
      const result: Input={...old,...clone(value),identity_token:value.identity_token ?? crypto.randomUUID()}
      if(value.exercises) result.exercises=value.exercises.map((e: Input)=>materialize(e,old?.exercises ?? []))
      if(value.set_groups) result.set_groups=value.set_groups.map((r: Input)=>materialize(r,old?.set_groups ?? []))
      return result
    }
    day={...clone(day),movement_groups:day.movement_groups.map(g=>materialize(g,previous?.movement_groups ?? [])),ungrouped_exercises:day.ungrouped_exercises.map(e=>materialize(e,previous?.ungrouped_exercises ?? []))} as RichProgramDayV2
    program.days[day.identity_token]=day
    const summary=program.detail.weeks.flatMap(w=>w.days).find(d=>d.day_identity_token===day.identity_token)
    if(summary){const exercises=[...day.ungrouped_exercises,...day.movement_groups.flatMap(g=>g.exercises)];summary.label=day.label;summary.workout_title=day.marked_rest?null:(day.subtitle ?? day.label);summary.status=day.marked_rest?'rest':exercises.length?'workout':'authored_empty';summary.exercise_count=exercises.length;summary.set_row_count=exercises.reduce((n,e)=>n+e.set_groups.reduce((count,row)=>count+row.sets_min,0),0)}
    program.detail.builder_version++;program.detail.detail_read_token=crypto.randomUUID();persist()
  }
  const detailTemplate=(input:Input)=>{const t=template(input);return {contract_version:1,template_id:t.id,gym_id:'local-gym',name:t.name,default_unit:t.program.detail.default_unit,builder_version:t.program.detail.builder_version,archived_at:t.archived?now():null,weeks:t.program.detail.weeks.map(w=>({week_id:w.week_identity_token,week_ordinal:w.week_ordinal,days:w.days.map(d=>({day_id:d.day_identity_token,day_ordinal:d.day_ordinal,label:d.label,subtitle:null,marked_rest:d.status==='rest',supported:true,exercise_count:d.exercise_count,set_count:d.set_row_count}))}))}}
  const templateDay=(input:Input)=>{const t=template(input),day=clone(t.program.days[input.day_id]);return {contract_version:3,template_id:t.id,day_id:input.day_id,builder_version:t.program.detail.builder_version,percent_basis_options:options,exercise_options:options,supported:true,day:{...JSON.parse(JSON.stringify(day).replaceAll('identity_token','id')),identity_token:day.identity_token}}}
  const api:Record<string,(input:Input)=>Promise<any>>={
    getCoachNavigationGymsV4:async()=>({navigation_read_token:{},items:[{gym_id:'local-gym',gym_name:'Unrack · Local workspace',role:'owner'}],has_more:false,next_cursor:null}),
    getCoachNavigationRosterV4:async()=>({navigation_read_token:{},items:model.athletes.map(a=>({gym_id:'local-gym',athlete_id:a.id,roster_name:a.name,roster_status:'active',active_device_count:0})),has_more:false,next_cursor:null}),
    getCoachNavigationAssignmentsV4:async input=>({navigation_read_token:{},items:model.athletes.filter(a=>a.id===input.athlete && a.program).map(a=>({...assignment(a.program!),gym_id:'local-gym',athlete_id:a.id,builder_version:a.program!.detail.builder_version,delivery:{status:'draft',released_at:null,expected_receipts:0,issued_receipts:0,acknowledged_receipts:0}})),has_more:false,next_cursor:null}),
    getCoachDashboardRosterPageV1:async input=>roster(input),getCoachDashboardRosterPageV2:async input=>roster(input),
    getCoachDashboardAssignmentsPageV1:async input=>page(model.athletes.filter(a=>a.id===input.athlete && a.program).map(a=>assignment(a.program!))),
    getCoachDashboardAssignmentsPageV2:async input=>page(model.athletes.filter(a=>a.id===input.athlete && a.program).map(a=>assignment(a.program!)),2),
    getCoachAssignmentDetailV4:async input=>clone(find(input).detail),getCoachAssignmentDetailV5:async input=>clone(find(input).detail),
    getCoachAssignmentDayV4:async()=>{throw new Error('Use the current rich day editor.')},
    getCoachAssignmentDayV5:async()=>{throw new Error('Use the current rich day editor.')},
    saveCoachProgramDayV3:async()=>{throw new Error('Use the current rich day editor.')},
    getCoachAssignmentDayV7:async input=>{const p=find(input),summary=p.detail.weeks.flatMap(w=>w.days).find(d=>d.day_identity_token===input.day_identity_token);return {contract_version:7,detail_read_token:p.detail.detail_read_token,program_id:p.detail.program_id,assignment_id:p.detail.assignment_id,builder_version:p.detail.builder_version,percent_basis_options:[],exercise_options:options,day:{mode:'editable',content:{...clone(p.days[input.day_identity_token]),locked:false,locked_any:false,planned_date:summary?.planned_date,system_weekday:summary?.system_weekday,workout_title:summary?.workout_title,day_editable:true,day_unsupported_reason:null}}}},
    saveCoachProgramDayV5:async input=>{const p=find(input);updateDay(p,input.day);return {contract_version:5,program_id:p.detail.program_id,assignment_id:p.detail.assignment_id,day_identity_token:input.day.identity_token,builder_version:p.detail.builder_version,unchanged:false,day:clone(input.day)}},
    addRosterAthlete:async input=>{const athlete={id:crypto.randomUUID(),name:input.new_roster_name,program:null};model.athletes.push(athlete);persist();return athlete.id},
    createCalendarProgramV2:async input=>{const athlete=model.athletes.find(a=>a.id===(input.target_athlete ?? input.athlete));if(!athlete)throw new Error('Local athlete not found.');athlete.program=createProgram(athlete.id,input.program_name,input.week_count,input.start_on);persist();const d=athlete.program.detail;return [{program_id:d.program_id,assignment_id:d.assignment_id,first_day_identity_token:d.weeks[0].days[0].day_identity_token,builder_version:d.builder_version}]},
    activateAndPublishCoachAssignmentV1:async()=>{throw new Error('Publishing is unavailable in the local sample workspace.')},
    setCoachProgramReadinessV1:async input=>{const p=find(input);p.detail.authoring.readiness=input.readiness ?? 'ready';p.detail.authoring.ready_builder_version=p.detail.builder_version;persist();return {program_id:p.detail.program_id,assignment_id:p.detail.assignment_id,builder_version:p.detail.builder_version,readiness:p.detail.authoring.readiness,changed:true,ready_at:now(),issue_count:'0',issues_truncated:false,issues:[]}},
    previewBuilderCopyV1:async()=>{throw new Error('Copy preview needs a dedicated local scenario.')},applyBuilderCopyV1:async()=>{throw new Error('Copy is unavailable in this local scenario.')},
    previewBuilderProgressionV1:async()=>{throw new Error('Progression preview needs a dedicated local scenario.')},applyBuilderProgressionV1:async()=>{throw new Error('Progression is unavailable in this local scenario.')},
    undoBuilderOperationV1:async()=>{throw new Error('Nothing to undo in this local scenario.')},publishReadyProgramV1:async()=>{throw new Error('Publishing is unavailable in the local sample workspace.')},
    authorCalendarDayV1:async()=>{throw new Error('Calendar authoring needs a dedicated local scenario.')},
    listExerciseNameHistoryV1:async()=>({items:options.map(o=>({name:o.name}))}),recordExerciseNameHistoryV1:async()=>({recorded_count:0,retained_count:options.length}),
    saveCoachProgramDayV2AndRecordHistory:async()=>{throw new Error('Use the current rich editor.')},
    previewBuilderCopyV2:async()=>{throw new Error('Copy preview needs a dedicated local scenario.')},applyBuilderCopyV2:async()=>{throw new Error('Copy is unavailable in this local scenario.')},
    getCoachProgramTemplateLibraryV1:async()=>({contract_version:1,items:model.templates.map(t=>({template_id:t.id,name:t.name,builder_version:t.program.detail.builder_version,archived_at:t.archived?now():null,week_count:t.program.detail.weeks.length})),has_more:false,next_cursor:null}),
    getCoachProgramTemplateDetailV1:async input=>detailTemplate(input),
    getCoachProgramTemplateDayV1:async input=>templateDay(input),getCoachProgramTemplateDayV2:async input=>templateDay(input),getCoachProgramTemplateDayV3:async input=>templateDay(input),
    createCoachProgramTemplateV1:async input=>{
      const t={id:crypto.randomUUID(),name:input.template_name,program:createProgram('local-template',input.template_name,input.week_count),archived:false}
      // New templates start empty, matching the connected creation contract.
      for(const day of Object.values(t.program.days)){day.marked_rest=false;day.ungrouped_exercises=[];day.movement_groups=[]}
      for(const day of t.program.detail.weeks.flatMap(week=>week.days)){day.status='authored_empty';day.workout_title=null;day.exercise_count=0;day.set_row_count=0}
      t.program.detail.builder_version=1;model.templates.push(t);persist();return {template_id:t.id,builder_version:1}
    },
    saveCoachProgramTemplateDayV3:async input=>{const t=template(input);const day=JSON.parse(JSON.stringify(input.day).replaceAll('"id":','"identity_token":'));day.identity_token=input.day_id ?? input.day.identity_token;updateDay(t.program,day);return {contract_version:3,template_id:t.id,day_id:day.identity_token,builder_version:t.program.detail.builder_version,day:input.day}},
    saveCoachProgramTemplateDayV2:async()=>{throw new Error('Use the current template editor.')},
    saveCoachProgramTemplateDayV1:async()=>{throw new Error('Use the current template editor.')},
    appendCoachProgramTemplateWeekV1:async()=>{throw new Error('Add-week preview needs a dedicated local scenario.')},
    copyCoachProgramTemplateWeekV1:async()=>{throw new Error('Copy preview needs a dedicated local scenario.')},
    applyCoachProgramTemplateV2:async()=>{throw new Error('Template application needs a dedicated local scenario.')},
    ensureCoachExerciseV1:async input=>({exercise_id:crypto.randomUUID(),name:input.exercise_name,default_basis_exercise_id:null}),
    getAthleteProfileV1:async input=>clone(model.profiles[input.target_athlete ?? input.athlete] ?? {contract_version:1,gym_id:'local-gym',athlete_id:input.target_athlete ?? input.athlete,name:model.athletes.find(a=>a.id===(input.target_athlete ?? input.athlete))?.name ?? 'Local athlete',sex_category:null,bodyweight_value:180,bodyweight_unit:'lb',preferred_weight_unit:'lb',tested_1rm_squat:315,tested_1rm_bench:225,tested_1rm_deadlift:405,tested_1rm_unit:'lb',profile_version:1,updated_at:now(),updated_by:null}),
    saveAthleteProfileV1:async input=>{const athlete=model.athletes.find(a=>a.id===input.target_athlete);if(athlete)athlete.name=input.profile.name;const profile={...input.profile,contract_version:1,gym_id:'local-gym',athlete_id:input.target_athlete,profile_version:input.expected_version+1,updated_at:now(),updated_by:'coach'};model.profiles[input.target_athlete]=profile;persist();return profile},
    getProgrammingMaxesV1:async()=>({contract_version:1,gym_id:'local-gym',profile:{profile_version:1,tested_1rm_squat:315,tested_1rm_bench:225,tested_1rm_deadlift:405,tested_1rm_unit:'lb'},maxes:[],candidates:[],basis_options:options.map(o=>({...o,archived_at:null,latest_tested_1rm:null,latest_training_max:null}))}),
    getAthleteTrackingV1:async()=>({contract_version:1,tracking_version:1,system_required:options.slice(0,3).map((o,i)=>({...o,lift:['squat','bench','deadlift'][i]})),coach_required:[],athlete_added:[],effective:options.slice(0,3)}),
    getAthleteMetricsV1:async()=>({contract_version:1,gym_id:'local-gym',tracking_version:1,tracked_lifts:options.slice(0,3).map(o=>({...o,top_weight:null,top_unit:null,estimated_1rm:null,estimated_1rm_unit:null,latest_at:null})),recent_sessions:[]}),
    getTrainingReportV1:async input=>({contract_version:1,assignment_id:input.assignment,ready:false,completed_at:null,summary:null}),
    getCoachAthleteCalendarV1:async input=>({contract_version:1,workouts:model.athletes.filter(a=>a.id===input.target_athlete && a.program).flatMap(a=>a.program!.detail.weeks.flatMap(w=>w.days.filter(d=>d.status==='workout').map(d=>({workout_instance_id:`local-${d.day_identity_token}`,assignment_id:a.program!.detail.assignment_id,logical_day_id:d.day_identity_token,receipt_id:null,title:d.label,program_name:a.program!.detail.program_name,week_ordinal:w.week_ordinal,day_ordinal:d.day_ordinal,original_date:d.planned_date,scheduled_date:d.planned_date,version:1,state:'not_started',updated_at:now(),note:null}))))}),
    getCoachAthleteNotesV1:async input=>clone(model.profiles[`notes:${input.target_athlete}`]??{contract_version:1,gym_id:input.target_gym,athlete_id:input.target_athlete,text:'',version:0,updated_at:null}),
    saveCoachAthleteNotesV1:async input=>{const key=`notes:${input.target_athlete}`;const value={contract_version:1,gym_id:input.target_gym,athlete_id:input.target_athlete,text:input.note_text,version:input.expected_version+1,updated_at:now()};model.profiles[key]=value;persist();return clone(value)},
    getCoachAthleteActivityPageV1:async()=>({contract_version:1,items:[],has_more:false,next_cursor:null,summary:{completed:0,skipped:0,last_session:null}}),
    getCoachAthleteMetricsV1:async input=>({contract_version:1,gym_id:input.target_gym,athlete_id:input.target_athlete,tracking_version:1,tracked_lifts:[],recent_sessions:[]}),
    getCoachRecentActivityPageV1:async()=>({contract_version:1,items:[],has_more:false,next_cursor:null,next_read_token:null}),
  }
  const unavailable=async()=>{throw new Error('This workflow needs a dedicated local review scenario.')}
  const workoutDetail=async(input: Input)=>{const t=template(input);return {contract_version:2,template_id:t.id,gym_id:'local-gym',name:t.name,default_unit:'lb',plate_increment:5,builder_version:t.program.detail.builder_version,readiness:'draft',archived_at:t.archived?now():null,supported:true,rich_supported:true,read_token:'local-workout-read'}}
  const workoutDay=async(input: Input)=>{const t=template(input);const dayId=t.program.detail.weeks[0].days[0].day_identity_token!;return {...templateDay({...input,day_id:dayId}),read_token:'local-workout-read',rich_supported:true}}
  api.getCoachWorkoutTemplateLibraryPageV1=async input=>({contract_version:2,gym_id:'local-gym',lifecycle:input.lifecycle,search_text:input.search_text,page_size:20,items:model.templates.filter(t=>input.lifecycle==='historical'?t.archived:!t.archived).map(t=>({template_id:t.id,name:t.name,builder_version:t.program.detail.builder_version,readiness:'draft',archived_at:t.archived?now():null,supported:true,rich_supported:true})),has_more:false,next_cursor:null,next_read_token:null,read_token:'local-workout-read',library_lifecycle_key:'local-library',library_generation:1})
  api.getCoachWorkoutTemplateLibraryPageV2=api.getCoachWorkoutTemplateLibraryPageV1
  api.getCoachWorkoutTemplateDetailV1=workoutDetail;api.getCoachWorkoutTemplateDetailV2=workoutDetail
  api.getCoachWorkoutTemplateDayV1=workoutDay;api.getCoachWorkoutTemplateDayV2=workoutDay;api.getCoachWorkoutTemplateDayV3=workoutDay
  api.createCoachWorkoutTemplateV1=async input=>{const t={id:crypto.randomUUID(),name:input.template_name,program:createProgram('local-template',input.template_name,1),archived:false};model.templates.push(t);persist();return {contract_version:1,template_id:t.id,day_identity_token:t.program.detail.weeks[0].days[0].day_identity_token,builder_version:1,readiness:'draft',archived:false}}
  api.saveCoachWorkoutTemplateDayV3=async input=>{const t=template(input);return api.saveCoachProgramTemplateDayV3({...input,day_id:t.program.detail.weeks[0].days[0].day_identity_token})}
  api.saveCoachWorkoutTemplateDayV1=unavailable;api.saveCoachWorkoutTemplateDayV2=unavailable
  api.setCoachWorkoutTemplateReadinessV1=unavailable;api.setCoachWorkoutTemplateReadinessV2=unavailable
  api.archiveCoachWorkoutTemplateV1=unavailable;api.restoreCoachWorkoutTemplateV1=unavailable
  api.applyCoachWorkoutTemplateV1=unavailable;api.applyCoachWorkoutTemplateV2=unavailable
  api.saveCoachProgramDayV4=api.saveCoachProgramDayV5
  api.getCoachAssignmentDayV6=api.getCoachAssignmentDayV7
  api.getCoachProgrammingMaxesV1=api.getProgrammingMaxesV1
  api.getCoachAthleteMetricsV1=api.getAthleteMetricsV1
  api.getCoachTrainingReportV1=api.getTrainingReportV1
  persist()
  return api as unknown as ComponentProps<typeof ConnectedCoachApp>['api'] & { getCoachAssignmentDayV7(input: Input): Promise<import('../lib/coach-api').CoachAssignmentDayV7>; saveCoachProgramDayV5(input: Input): Promise<unknown> }
}
