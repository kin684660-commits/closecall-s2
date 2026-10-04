import {equitySession} from './calendar-base';
export {equitySession};
export function nyDate(at:Date){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(at);}
export function nyInstant(day:string,hour:number,minute=0){
 const guess=new Date(`${day}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00Z`);
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',hourCycle:'h23'}).formatToParts(guess).map(p=>[p.type,p.value]));
 const offset=(hour-Number(parts.hour)+24)%24;
 return new Date(guess.getTime()+offset*3600000);
}
export function sessionFor(day:string){
 const year=Number(day.slice(0,4));if(year<2026||year>2028)throw Error('交易日历仅核验 2026–2028 年');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||new Date(day+'T12:00:00Z').toISOString().slice(0,10)!==day)throw Error('Invalid date');
 const noon=nyInstant(day,12);if(equitySession(noon)!=='regular-hours')return null;
 const early=equitySession(nyInstant(day,14))!=='regular-hours';
 return {date:day,open:nyInstant(day,9,30),close:nyInstant(day,early?13:16),early};
}
export function nextSession(at=new Date()){
 let day=nyDate(at);
 for(let i=0;i<15;i++){
  const s=sessionFor(day);if(s&&s.open.getTime()>at.getTime()+180000)return s;
  day=new Date(Date.parse(day+'T12:00:00Z')+86400000).toISOString().slice(0,10);
 }
 throw Error('No verified upcoming session');
}
