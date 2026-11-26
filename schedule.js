const workoutStart = '20:00';
export const startOptions = ['20:00','20:30'];
const alertTime = '18:30';
const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const weekdayCodes = {mon:'MO', tue:'TU', wed:'WE', thu:'TH', fri:'FR', sat:'SA', sun:'SU'};
const pad = n => String(n).padStart(2,'0');
const weekendSchedule = {title:'Ходьба',muscles:'Бёдра, ягодицы и икры',gear:'Беговая дорожка или прогулка на улице',
  short:'минимум 5 км',note:'Выбери удобное время.',allDay:true};

export const schedule = {
  mon: {title:'Ноги и пресс', muscles:'Квадрицепсы, задняя поверхность бедра, ягодицы, икры, пресс', gear:'Гиря 16 кг, гантели по 12 кг, коврик', short:'бёдра, икры, пресс · гиря, гантели, коврик'},
  tue: {title:'Верх тела и сайклинг', muscles:'Спина, грудь, плечи, бицепсы, трицепсы', gear:'Турник, гантели по 12 кг, резинка 20 кг, велотренажёр', short:'спина, грудь, руки · турник, гантели, резинка, вело', note:'Сайклинг 40 минут после силовой части.'},
  wed: {title:'Пресс, хват и ходьба', muscles:'Пресс и предплечья', gear:'Коврик, кистевой роллер, эспандер или подвесные конусы, беговая дорожка', short:'пресс, предплечья · коврик, роллер, эспандер или конусы, дорожка', note:'Быстрая ходьба до 5 км.'},
  thu: {title:'Бёдра и икры', muscles:'Квадрицепсы, задняя поверхность бедра, ягодицы, икры', gear:'Гиря 16 кг, коврик, опора для подъёмов на носки', short:'бёдра, ягодицы, икры · гиря, коврик, опора'},
  fri: {title:'Верх тела и сайклинг', muscles:'Плечи, спина, грудь, трапеции, бицепсы, трицепсы и предплечья', gear:'Турник, гантели по 12 кг, резинка 20 кг, коврик, велотренажёр', short:'плечи, спина, руки · турник, гантели, резинка, коврик, вело', note:'Сайклинг 40 минут после силовой части.'},
  sat:weekendSchedule,
  sun:weekendSchedule
};

export const calendarTimes = {workoutStart, alertTime};

function minuteOfDay(time){
  const [hour,minute]=time.split(':').map(Number);
  return hour*60+minute;
}

export function timeAt(minutes){
  return pad(Math.floor(minutes/60))+':'+pad(minutes%60);
}

export function todayInfo(now = new Date()){
  const key=dayKeys[now.getDay()];
  return {key, workout:key ? schedule[key] : null,
    label:new Intl.DateTimeFormat('ru-RU',{weekday:'long',day:'numeric',month:'long'}).format(now)};
}

function dateKey(date) {
  return [date.getFullYear(),pad(date.getMonth()+1),pad(date.getDate())].join('');
}

function compactTime(time) {
  return time.replace(':','')+'00';
}

function firstWorkout(key, now, start) {
  const date=new Date(now);
  const target=dayKeys.indexOf(key);
  let offset=(target-date.getDay()+7)%7;
  const time=pad(date.getHours())+':'+pad(date.getMinutes());
  if (!offset && start && time>=start) offset=7;
  date.setDate(date.getDate()+offset);
  return dateKey(date);
}

function calendarText(text){
  return text.replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
}

function fold(line){
  const encoder=new TextEncoder();
  let result='', count=0;
  for(const cp of line){
    const bytes=encoder.encode(cp).length;
    if(count+bytes>75){result+='\r\n ';count=1;}
    result+=cp;
    count+=bytes;
  }
  return result;
}

export function makeCalendar(now = new Date(), preferredStart = workoutStart){
  const start=startOptions.includes(preferredStart)?preferredStart:workoutStart;
  const end=timeAt(minuteOfDay(start)+90);
  const alarm=minuteOfDay(start)-minuteOfDay(alertTime);
  const stamp=now.toISOString().replace(/[:-]/g,'').replace(/\.\d{3}Z$/,'Z');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Personal Training//Weekly Plan//RU',
    'CALSCALE:GREGORIAN','X-WR-CALNAME:План тренировок'];
  for(const [key,data] of Object.entries(schedule)){
    const date=firstWorkout(key,now,data.allDay?null:start);
    const title=calendarText(data.title+' · '+data.short);
    const details=calendarText(['Мышцы: '+data.muscles,'Инвентарь: '+data.gear,data.note].filter(Boolean).join('\n'));
    lines.push('BEGIN:VEVENT','UID:training-week-'+key+'@personal-training.local','DTSTAMP:'+stamp);
    if(data.allDay)lines.push('DTSTART;VALUE=DATE:'+date);
    else lines.push('DTSTART:'+date+'T'+compactTime(start),'DTEND:'+date+'T'+compactTime(end));
    lines.push('RRULE:FREQ=WEEKLY;BYDAY='+weekdayCodes[key],'SUMMARY:'+title,'DESCRIPTION:'+details);
    if(!data.allDay)lines.push('BEGIN:VALARM','TRIGGER:-PT'+alarm+'M','ACTION:DISPLAY','DESCRIPTION:'+title,'END:VALARM');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n')+'\r\n';
}
