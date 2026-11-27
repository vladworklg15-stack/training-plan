import {exercises,muscles} from './exercises.js?v=9';
import {exerciseVideos} from './videos.js';
import {exerciseIllustrations} from './illustrations.js?v=9';
import {kettlebellAlternatives,kettlebellMedia,kettlebellVideos} from './kettlebells.js';
import {calendarTimes,makeCalendar,schedule,startOptions} from './schedule.js?v=9';
import {beginTimer,coreMoves,coreRounds,coreSeconds,formatClock,intervals,pauseTimer,plans,restSeconds,resumeTimer,sessionDate,updateTimer,weekAt} from './workout.js?v=9';

const el=id=>document.getElementById(id);
const overview=el('overview'), session=el('session');
const video=el('exercise-video'), videoSource=el('video-source');
const exerciseFigure=el('exercise-figure'), illustration=el('exercise-illustration');
const kettlebellLibrary=el('kettlebell-library'), kettlebellPlayer=el('kettlebell-video');
const dateFormat=new Intl.DateTimeFormat('ru-RU',{weekday:'long',day:'numeric',month:'long'});
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const storeKey='training-week-in-progress-v1';
const settingsKey='training-week-calendar-start';
const addedExercisePositions={wed:1,thu:0,fri:7};
const read = key => {
  try { return JSON.parse(localStorage.getItem(key)); }
  catch { return null; }
};
const save = (key,value) => {
  try { localStorage.setItem(key,JSON.stringify(value)); } catch {}
};

let selected=null;
let active=null;
let pageProgress=null;
let currentExercise=null;
const timerSignals={
  work:'./media/timer-work.wav',
  rest:'./media/timer-rest.wav',
  complete:'./media/timer-complete.wav'
};
const timerAudio=el('timer-audio');
let wakeLock=null;
let wakeRequest=null;
let currentDate=sessionDate(new Date());
let kettlebellOpener=null;
let lastKettlebell=kettlebellVideos[0];

function resetScroll(){window.scrollTo(0,0);}
function titleFor(item){return item.id==='core'?'Комплекс на пресс':item.title||exercises[item.id].title;}
function gearFor(item){return item.id==='core'?'Коврик':item.gear||exercises[item.id].gear;}
function doseFor(item){
  if(item.id==='core') return coreRounds+' круга · '+formatClock(coreSeconds*1000);
  if(item.target)return item.target;
  return item.sets+' × '+item.reps;
}
function text(id,value) {
  if(el(id).textContent!==value)el(id).textContent=value;
}
function workoutFor(day){return plans[day.key];}
function recover(day){
  const value=pageProgress??read(storeKey);
  if(value?.date!==sessionDate(day.date) || value.key!==day.key ||
    !Number.isInteger(value.index) || value.index<0) return null;
  // Older sessions recorded only the index, before the kettlebell exercises were inserted.
  const index=value.exerciseId ? workoutFor(day).findIndex(item=>item.id===value.exerciseId)
    : value.index+Number(value.index>=(addedExercisePositions[day.key]??Infinity));
  if(index<0 || index>=workoutFor(day).length)return null;
  return {...value,index,timer:value===pageProgress?value.timer:null};
}
function newDay() {
  const now=new Date();
  const today=sessionDate(now);
  return weekAt(now).find(day=>sessionDate(day.date)===today);
}

function make(tag,className,content){
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(content!==undefined)node.textContent=content;
  return node;
}

function renderOverview(){
  const today=sessionDate(new Date());
  const buttons=weekAt(new Date()).map(day=>{
    const number=String(day.date.getDate());
    const button=make('button','week-day');
    button.type='button';
    button.setAttribute('aria-pressed',String(sessionDate(day.date)===sessionDate(selected.date)));
    button.setAttribute('aria-label',dateFormat.format(day.date));
    if(sessionDate(day.date)===today)button.setAttribute('aria-current','date');
    button.append(make('span','',day.short),make('strong','',number));
    button.addEventListener('click',()=>{
      selected=day;
      renderOverview();
      el('week').querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});
    });
    return button;
  });
  el('week').replaceChildren(...buttons);
  const summary=schedule[selected.key];
  const isToday=sessionDate(selected.date)===today;
  text('day-date',(isToday?'Сегодня · ':'')+dateFormat.format(selected.date));
  text('day-title',summary?.title||'День отдыха');
  text('day-muscles',summary?.muscles||'');
  text('day-time',summary?.allDay?'В удобное время':summary?`Ориентир начала ${el('calendar-start').value}`:'');
  const entries=workoutFor(selected);
  el('day-plan').replaceChildren(...entries.map(item=>{
    const row=make('article','plan-row');
    const heading=make('div');
    heading.append(make('h2','',titleFor(item)),make('p','plan-dose',doseFor(item)));
    row.append(heading,make('p','muted',gearFor(item)));
    if(item.id==='core'){
      const list=make('ol','core-list');
      for(const move of coreMoves)list.append(make('li','',exercises[move.id].title+' · '+move.seconds+' сек.'));
      row.append(list,make('p','muted','Отдых между этапами · '+restSeconds+' сек.'));
    }
    return row;
  }));
  el('begin-bar').hidden=entries.length===0;
  text('begin',recover(selected)?'Продолжить':'Начать');
  const alternative=kettlebellVideos.find(clip=>clip.id===kettlebellAlternatives[selected.key]);
  el('kettlebell-today').hidden=!alternative;
  text('kettlebell-entry-summary',alternative
    ? 'Вариант вместо силового блока · '+alternative.title
    : 'Выбери видео для отдельной тренировки с гирей.');
}

function selectKettlebell(clip){
  lastKettlebell=clip;
  kettlebellPlayer.pause();
  kettlebellPlayer.poster=kettlebellMedia(clip.id,'jpg');
  kettlebellPlayer.src=kettlebellMedia(clip.id,'mp4');
  kettlebellPlayer.setAttribute('aria-label','Видео · '+clip.title);
  kettlebellPlayer.load();
  text('kettlebell-kind',clip.kind+' · '+formatClock(clip.seconds*1000)+' видео');
  text('kettlebell-title',clip.title);
  text('kettlebell-moves',clip.moves);
  text('kettlebell-format',clip.format||'');
  el('kettlebell-format').hidden=!clip.format;
  el('kettlebell-error').hidden=true;
  const chapters=el('kettlebell-chapters');
  chapters.hidden=!clip.chapters?.length;
  chapters.replaceChildren(...(clip.chapters||[]).map(point=>{
    const button=make('button','outline',point.title);
    button.type='button';
    button.addEventListener('click',()=>{
      kettlebellPlayer.currentTime=point.time;
      void kettlebellPlayer.play().catch(()=>{});
    });
    return button;
  }));
  for(const item of el('kettlebell-list').children){
    item.setAttribute('aria-pressed',String(item.dataset.clip===clip.id));
  }
  el('kettlebell-title').focus({preventScroll:true});
  resetScroll();
}

function openKettlebells(clip,opener){
  kettlebellOpener=opener;
  overview.hidden=true;
  kettlebellLibrary.hidden=false;
  selectKettlebell(clip);
}

el('kettlebell-list').replaceChildren(...kettlebellVideos.map(clip=>{
  const button=make('button','kettlebell-option');
  button.type='button';
  button.dataset.clip=clip.id;
  const thumbnail=make('img');
  thumbnail.alt='';
  thumbnail.loading='lazy';
  thumbnail.src=kettlebellMedia(clip.id,'jpg');
  const labels=make('span');
  labels.append(make('strong','',clip.title),make('span','muted',clip.kind+' · '+formatClock(clip.seconds*1000)));
  button.append(thumbnail,labels);
  button.addEventListener('click',()=>selectKettlebell(clip));
  return button;
}));
el('kettlebell-open').addEventListener('click',()=>openKettlebells(lastKettlebell,el('kettlebell-open')));
el('kettlebell-today').addEventListener('click',()=>{
  const clip=kettlebellVideos.find(video=>video.id===kettlebellAlternatives[selected.key]);
  if(clip)openKettlebells(clip,el('kettlebell-today'));
});
el('kettlebell-back').addEventListener('click',()=>{
  kettlebellPlayer.pause();
  kettlebellPlayer.removeAttribute('src');
  kettlebellPlayer.load();
  kettlebellLibrary.hidden=true;
  overview.hidden=false;
  renderOverview();
  (kettlebellOpener.hidden?el('kettlebell-open'):kettlebellOpener).focus();
});
kettlebellPlayer.addEventListener('error',()=>{
  if(kettlebellPlayer.hasAttribute('src'))el('kettlebell-error').hidden=false;
});

function persist(){
  pageProgress=!active||active.finished?null:{...active,exerciseId:plans[active.key][active.index].id};
  const {key,date,index,exerciseId}=pageProgress||{};
  save(storeKey,pageProgress?{key,date,index,exerciseId}:null);
}

function signal(cue){
  const file=timerSignals[cue];
  if(timerAudio.getAttribute('src')===file)timerAudio.currentTime=0;
  else timerAudio.setAttribute('src',file);
  void timerAudio.play().then(()=>{
    el('timer-audio-status').hidden=true;
  }).catch(error=>{
    if(error.name==='AbortError')return;
    text('timer-audio-status','Звук не запустился. Нажми «Проверить звук».');
    el('timer-audio-status').hidden=false;
  });
}
function keepScreenOn(){
  if(wakeLock || wakeRequest || document.hidden || active?.timer?.mode!=='running')return;
  const request=navigator.wakeLock?.request('screen');
  if(!request)return;
  wakeRequest=request;
  request.then(lock=>{
    wakeRequest=null;
    if(active?.timer?.mode!=='running'||document.hidden){
      void lock.release().catch(()=>{});
      return;
    }
    wakeLock=lock;
    lock.addEventListener('release',()=>{if(wakeLock===lock)wakeLock=null;});
  }).catch(()=>{wakeRequest=null;});
}
function releaseScreen(){
  if(!wakeLock)return;
  const lock=wakeLock;
  wakeLock=null;
  void lock.release().catch(()=>{});
}
function showExercise(id){
  const next=exercises[id]||null;
  el('exercise-content').hidden=!next;
  if(next===currentExercise)return;
  currentExercise=next;
  video.pause();
  if(video.hasAttribute('src')){
    video.removeAttribute('src');
    video.load();
  }
  exerciseFigure.hidden=true;
  illustration.removeAttribute('src');
  if(!next)return;
  text('muscles',[...new Set([...next.primary,...next.secondary])].map(key=>muscles[key]).join(', '));
  text('tip',next.tip);
  text('avoid',next.avoid);
  const clip=exerciseVideos[id];
  const hasFile=Boolean(clip?.file);
  const drawing=exerciseIllustrations[id];
  exerciseFigure.hidden=!drawing || hasFile;
  if(!exerciseFigure.hidden){
    illustration.src=drawing.file;
    illustration.alt=drawing.alt;
    el('exercise-phases').hidden=!drawing.phases;
  }
  video.hidden=!hasFile;
  videoSource.hidden=!clip?.url;
  text('video-status','Видео для этого упражнения ещё подбирается.');
  el('video-status').hidden=hasFile || Boolean(clip?.url) || !exerciseFigure.hidden;
  if(clip?.url){
    videoSource.href=clip.url;
    text('video-source',clip.credit);
  }
  if(hasFile){
    video.src=clip.file;
    video.setAttribute('aria-label','Видео техники · '+next.title);
    if(!reduced.matches)void video.play().catch(()=>{});
  }
}

function renderTimer(now){
  const timer=active.timer;
  const complete=timer?.mode==='complete';
  const phase=intervals[timer?.phase??0];
  const rest=phase?.kind==='rest';
  const remaining=!timer?phase.seconds*1000:timer.mode==='running'?timer.until-now:timer.remaining;
  el('timer').dataset.mode=rest?'rest':'work';
  let status='Круг '+(phase?.round??coreRounds)+' из '+coreRounds+' · ';
  if(complete)status='Оба круга выполнены';
  else if(!timer)status+= 'Готов к старту';
  else status+= (rest?'Отдых':'Работа')+(timer.mode==='paused'?' · пауза':'');
  text('timer-status',status);
  text('timer-clock',complete?'0:00':formatClock(remaining));
  text('timer-next',rest?'Дальше · '+exercises[phase.id].title:'');
  el('timer-toggle').hidden=Boolean(complete);
  const duration=(phase?.seconds??1)*1000;
  el('timer-progress').max=duration;
  el('timer-progress').value=complete?duration:Math.min(duration,Math.max(0,duration-remaining));
  text('timer-toggle',!timer?'Запустить таймер':timer.mode==='paused'?'Продолжить таймер':'Пауза');
  text('exercise-title',rest?'Отдых':complete?'Пресс выполнен':exercises[phase.id].title);
  showExercise(complete?null:phase.id);
  el('next').hidden=!complete;
}

function renderSession(focus=false){
  const entries=plans[active.key];
  const item=entries[active.index];
  const done=active.finished;
  const core=item?.id==='core'&&!done;
  text('position',done?'Выполнено упражнений · '+entries.length:'Упражнение '+(active.index+1)+' из '+entries.length);
  text('gear',done?'':gearFor(item));
  text('dose',done?'':doseFor(item));
  el('timer').hidden=!core;
  if(core){
    renderTimer(Date.now());
  }else{
    text('exercise-title',done?'Тренировка завершена':titleFor(item));
    showExercise(done?null:item.id);
    el('next').hidden=false;
  }
  text('next',done?'Вернуться к плану':active.index===entries.length-1?'Завершить тренировку':
    core?'Продолжить тренировку':'Следующее упражнение');
  if(focus){
    el('exercise-title').focus({preventScroll:true});
    resetScroll();
  }
}

function tick(sound){
  if(session.hidden||active?.timer?.mode!=='running')return;
  const now=Date.now();
  const changed=updateTimer(active.timer,now);
  if(changed!==active.timer){
    active.timer=changed;
    if(sound&&!document.hidden)signal(changed.mode==='complete'?'complete':intervals[changed.phase].kind);
    if(changed.mode==='complete')releaseScreen();
    persist();
  }
  renderTimer(now);
}

function overviewScreen(){
  if(active?.timer?.mode==='running'){
    active.timer=pauseTimer(active.timer,Date.now());
    persist();
  }
  releaseScreen();
  timerAudio.pause();
  el('timer-audio-status').hidden=true;
  showExercise(null);
  session.hidden=true;
  overview.hidden=false;
  active=null;
  renderOverview();
  el('day-title').setAttribute('tabindex','-1');
  el('day-title').focus({preventScroll:true});
  resetScroll();
}

el('begin').addEventListener('click',()=>{
  active=recover(selected)||{key:selected.key,date:sessionDate(selected.date),index:0,timer:null};
  if(active.timer?.mode==='running')active.timer=updateTimer(active.timer,Date.now());
  if(active.timer?.mode==='running')active.timer=pauseTimer(active.timer,Date.now());
  persist();
  overview.hidden=true;
  session.hidden=false;
  renderSession(true);
});
el('back').addEventListener('click',overviewScreen);
el('next').addEventListener('click',()=>{
  if(active.finished){overviewScreen();return;}
  if(plans[active.key][active.index].id==='core'&&active.timer?.mode!=='complete')return;
  if(active.index===plans[active.key].length-1) active.finished=true;
  else {active.index++;active.timer=null;}
  persist();
  renderSession(true);
});
el('timer-toggle').addEventListener('click',()=>{
  const now=Date.now();
  const first=!active.timer;
  if(first)active.timer=beginTimer(now);
  else if(active.timer.mode==='paused')active.timer=resumeTimer(active.timer,now);
  else active.timer=pauseTimer(active.timer,now);
  if(active.timer.mode==='running'){
    signal(intervals[active.timer.phase].kind);
    keepScreenOn();
  }else{
    timerAudio.pause();
    releaseScreen();
  }
  persist();
  renderTimer(now);
});
el('timer-audio-test').addEventListener('click',()=>signal('work'));

el('calendar-start').value=startOptions.includes(read(settingsKey))?read(settingsKey):calendarTimes.workoutStart;
el('calendar-start').addEventListener('change',()=>{
  save(settingsKey,el('calendar-start').value);
  renderOverview();
});
el('calendar-export').addEventListener('click',()=>{
  const file=new Blob([makeCalendar(new Date(),el('calendar-start').value)],{type:'text/calendar;charset=utf-8'});
  const url=URL.createObjectURL(file);
  const link=document.createElement('a');
  link.href=url;
  link.download='План тренировок.ics';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
function updateDay(){
  const now=sessionDate(new Date());
  if(now===currentDate)return;
  currentDate=now;
  if(session.hidden)selected=newDay();
  if(!overview.hidden)renderOverview();
}
document.addEventListener('visibilitychange',()=>{
  if(document.hidden)return;
  updateDay();
  tick(false);
  keepScreenOn();
});
window.addEventListener('pageshow',event=>{
  if(!event.persisted)return;
  if(pageProgress)pageProgress.timer=null;
  if(!active?.timer)return;
  active.timer=null;
  timerAudio.pause();
  releaseScreen();
  renderSession();
});
setInterval(()=>tick(true),150);
setInterval(updateDay,30000);
selected=newDay();
renderOverview();
video.addEventListener('error',()=>{
  if(!video.hasAttribute('src'))return;
  video.hidden=true;
  text('video-status','Видео не загрузилось. Можно открыть запись по ссылке ниже.');
  el('video-status').hidden=false;
});
video.addEventListener('loadeddata',()=>{el('video-status').hidden=true;});
illustration.addEventListener('error',()=>{
  if(!illustration.hasAttribute('src'))return;
  exerciseFigure.hidden=true;
  if(videoSource.hidden){
    text('video-status','Иллюстрация не загрузилась.');
    el('video-status').hidden=false;
  }
});
if(location.protocol!=='file:'&&'serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js',{type:'module'}).catch(()=>{});
