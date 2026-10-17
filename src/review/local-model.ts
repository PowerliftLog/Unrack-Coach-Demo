import type { CoachAssignmentDetailV5, RichProgramDayV2 } from '../lib/coach-api'
export const weekdays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] as const
const id = () => crypto.randomUUID()
export const options = ['Back Squat','Bench Press','Deadlift','Chest-Supported Row','Lat Pulldown','DB Incline Press'].map((name,index)=>({exercise_id:`local-exercise-${index}`,name,default_basis_exercise_id:null}))
export type LocalProgram = { detail: CoachAssignmentDetailV5; days: Record<string,RichProgramDayV2> }
export type LocalAthlete = { id: string; name: string; program: LocalProgram | null }
export type LocalTemplate = { id: string; name: string; program: LocalProgram; archived: boolean }
export type LocalModel = { version: 1; athletes: LocalAthlete[]; templates: LocalTemplate[]; profiles: Record<string,unknown> }
export function createProgram(athlete: string, name: string, weeks=4, start='2026-10-05'): LocalProgram {
  const program=id(),assignment=id(),days: LocalProgram['days']={}
  const detail: CoachAssignmentDetailV5={contract_version:5,detail_read_token:id(),program_id:program,assignment_id:assignment,athlete_id:athlete,program_name:name,program_status:'draft',assignment_status:'active',builder_version:1,default_unit:'lb',plate_increment:5,phase4_editable:true,publish_boundary:{kind:'source_token',id:id()},calendar:{version:1,start_on:start,selected_weekdays:[1,3,5]},authoring:{readiness:'draft',ready_builder_version:null,ready_at:null,pending_undo:null},weeks:[]}
  for(let week=1;week<=weeks;week++) {
    const summaries: CoachAssignmentDetailV5['weeks'][number]['days']=[]
    for(let ordinal=1;ordinal<=7;ordinal++) {
      const token=id(),training=[1,3,5].includes(ordinal)
      const date=new Date(`${start}T00:00:00Z`);date.setUTCDate(date.getUTCDate()+(week-1)*7+ordinal-1)
      const names=ordinal===1?['Back Squat','Bench Press','Chest-Supported Row']:ordinal===3?['Bench Press','Deadlift','Lat Pulldown']:['Deadlift','Back Squat','DB Incline Press']
      const title=ordinal===1?'Squat focus':ordinal===3?'Bench focus':'Deadlift focus'
      const exercises: RichProgramDayV2['ungrouped_exercises']=training?names.map((name,index)=>({mode:'replace',identity_token:id(),ordinal:index+1,group_ordinal:null,status:'programmed',name,instruction:null,note:index===0?'Controlled reps. Leave one or two reps in reserve.':null,protocol:null,exercise_id:options.find(o=>o.name===name)?.exercise_id ?? null,track_in_metrics:index===0,set_groups:[{mode:'replace',identity_token:id(),ordinal:1,sets_mode:'exact',sets_min:index===0?4:3,sets_max:null,dose_mode:'reps',reps_mode:'exact',dose_min:index===0?5:10,dose_max:null,distance_unit:null,laterality:'bilateral',load_mode:'exact',load_basis:'total',exact_weight:index===0?225+(week-1)*5:index===1?135:60,percent:null,percent_basis_exercise_id:null,percent_basis_max_type:null,rpe_min:null,rpe_max:null,qualitative:null,unit_override:'lb',rest_seconds:index===0?180:90,note:null,manual_override:null,of_max_id:null,resolved_weight:null,resolved_max_effective_from:null,resolved_at:null}]})):[]
      days[token]={identity_token:token,ordinal,label:training?title:weekdays[ordinal-1],subtitle:null,marked_rest:!training,workout_instruction:training?'Warm up gradually before working sets.':null,movement_groups:[],ungrouped_exercises:exercises}
      summaries.push({day_identity_token:token,day_ordinal:ordinal,label:training?title:weekdays[ordinal-1],planned_date:date.toISOString().slice(0,10),status:training?'workout':'rest',locked_any:false,exercise_count:exercises.length,set_row_count:exercises.reduce((n,e)=>n+e.set_groups.reduce((count,row)=>count+row.sets_min,0),0),system_weekday:weekdays[ordinal-1],workout_title:training?title:null})
    }
    detail.weeks.push({week_identity_token:id(),week_ordinal:week,days:summaries})
  }
  return {detail,days}
}
export function seedModel(): LocalModel {
  const athletes=['Maya Chen','Marcus Reed','Sara Flores','Devon Price'].map((name,index)=>{const athlete=id();return {id:athlete,name,program:index===3?null:createProgram(athlete,index===0?'Fall strength · 4 weeks':index===1?'Strength base':'Powerbuilding')} })
  athletes[0].program!.detail.program_status='active';athletes[0].program!.detail.authoring.readiness='ready'
  return {version:1,athletes,templates:[{id:id(),name:'Full body strength · 4 weeks',program:createProgram('local-template','Full body strength · 4 weeks'),archived:false}],profiles:{}}
}
export function loadModel(storage: Pick<Storage,'getItem'>): LocalModel {
  const saved=storage.getItem('unrack-local-coach-workspace-v1')
  if(!saved) return seedModel()
  const model=JSON.parse(saved)
  if(model.version!==1 || !Array.isArray(model.athletes) || !Array.isArray(model.templates) || !model.profiles) throw new Error('Local workspace data needs review. Export or clear its browser storage to start again.')
  return model
}
