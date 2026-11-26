export const weekDays = [
  ['mon','Пн','Понедельник'], ['tue','Вт','Вторник'], ['wed','Ср','Среда'],
  ['thu','Чт','Четверг'], ['fri','Пт','Пятница'], ['sat','Сб','Суббота'], ['sun','Вс','Воскресенье']
];

const set = (id,sets,reps,gear)=>({id,sets,reps,gear});
const cardio = (id,target)=>({id,target});
const abs = {id:'core'};
export const plans = {
  mon:[set('goblet',3,'15'),set('rdl',3,'8–15'),set('lunge',2,'8–12 на ногу'),set('calf',3,'12–20 на ногу'),abs],
  tue:[set('pull',2,'10–12'),set('floorPress',3,'8–15'),set('row',2,'10–15 на руку'),
    set('curl',2,'10–15 на руку'),set('pushdown',2,'10–15 на руку'),cardio('cycle','40 минут')],
  wed:[abs,set('roller',2,'1 подъём и спуск'),set('gripper',2,'10–15 на руку'),cardio('walk','До 5 км')],
  thu:[set('split',3,'8–12 на ногу','Собственный вес'),set('kickRdl',3,'8–12 на ногу'),
    set('bridge',2,'10–15 на ногу'),set('bentCalf',3,'12–20')],
  fri:[set('pull',2,'10–12'),set('overhead',2,'8–12 на руку'),set('row',2,'10–15 на руку'),
    set('pushup',2,'8–15'),set('shrug',3,'12–20'),set('hammer',2,'10–15'),
    set('pushdown',2,'10–15 на руку'),cardio('cycle','40 минут')],
  sat:[],sun:[]
};

export const coreMoves = [
  {id:'crunch', seconds:35}, {id:'cross',seconds:35}, {id:'legRaise',seconds:35}, {id:'climber',seconds:60}
];
export const coreRounds = 2;
export const restSeconds = 15;
export const intervals = [];
for(let round=1;round<=coreRounds;round++){
  for(const [index,movement] of coreMoves.entries()){
    intervals.push({...movement,round,kind:'work'});
    const last = index===coreMoves.length-1;
    if(!last || round<coreRounds){
      intervals.push({kind:'rest',seconds:restSeconds,round:last?round+1:round,
        id:coreMoves[last?0:index+1].id});
    }
  }
}
export const coreSeconds = intervals.reduce((sum,phase)=>sum+phase.seconds,0);
export const formatClock = ms => {
  const seconds=Math.max(0,Math.ceil(ms/1000));
  return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
};

export function weekAt(now){
  const monday=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  monday.setDate(monday.getDate()-(monday.getDay()+6)%7);
  return weekDays.map(([key,short,label],index)=>{
    const date=new Date(monday);
    date.setDate(date.getDate()+index);
    return {key,short,label,date};
  });
}

export function sessionDate(date){
  return [date.getFullYear(),date.getMonth()+1,date.getDate()].join('-');
}

export function beginTimer(now){
  return {mode:'running',phase:0,until:now+intervals[0].seconds*1000,remaining:null};
}

export function updateTimer(timer,now){
  if(timer?.mode!=='running' || now<timer.until) return timer;
  let {phase,until}=timer;
  while(now>=until){
    phase++;
    if(phase>=intervals.length) return {mode:'complete',phase,until:null,remaining:0};
    until+=intervals[phase].seconds*1000;
  }
  return {...timer,phase,until};
}

export function pauseTimer(timer,now){
  const current=updateTimer(timer,now);
  if(current?.mode!=='running') return current;
  return {...current,mode:'paused',remaining:current.until-now,until:null};
}

export function resumeTimer(timer,now){
  if(timer?.mode!=='paused') return timer;
  return {...timer,mode:'running',until:now+timer.remaining,remaining:null};
}
