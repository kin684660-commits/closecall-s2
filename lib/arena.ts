import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {context,bitgetSnapshot,nativeDaily,nasdaqClose,evidence} from './market';
import {forecast} from './model';
import {nextSession} from './calendar';
import {seal,verifySeal,brier} from './proof';
import {insertRound,getRound,saveRound,event,reserve,db} from './store';
import {symbols,type Round,type Quote,type Result} from './types';
export const createSchema=z.object({symbol:z.enum(symbols),mode:z.enum(['close','sprint'])});
export const commitSchema=z.object({probability:z.number().min(0.05).max(0.95),thesis:z.string().trim().min(5).max(1000),public:z.boolean().default(false),alias:z.string().trim().min(1).max(24).default('匿名挑战者')});
let inflight=0;
export async function createRound(owner:string,input:unknown){
 const {symbol,mode}=createSchema.parse(input);if(inflight>=2)throw Error('竞技场正在准备挑战，请稍后再来');reserve(owner);inflight++;
 try{
  const source=await context(symbol,mode);const at=new Date(),session=mode==='close'?nextSession(at):null;
  if(mode==='close'&&at.getTime()-Date.parse(source.baseline.observedAt)>7*86400000)throw Error('基准收盘数据超过7天，暂不能发起挑战');
  const lockAt=mode==='sprint'?new Date(at.getTime()+180000):new Date(session!.open.getTime()-60000);
  const settleAt=mode==='sprint'?new Date(lockAt.getTime()+300000):new Date(session!.close.getTime()+1200000);
  const question=mode==='sprint'?`${symbol}USDT 股票永续：封盘后5分钟核验窗口内的首次合格 lastPrice，是否严格高于基准 ${source.baseline.price} USDT？`:`${symbol} 原生美股在纽约 ${session!.date} 的未复权日线收盘价，是否严格高于基准 ${source.baseline.price} USD？`;
  const rules:Round['rules']={version:'1.0',mode,symbol,question,baseline:source.baseline,lockAt:lockAt.toISOString(),settleAt:settleAt.toISOString(),expiresAt:new Date(settleAt.getTime()+(mode==='sprint'?120000:48*3600000)).toISOString(),targetDate:session?.date||null,settlementPolicy:mode==='sprint'?'Bitget官方SDK：目标时间到目标时间+120秒内，首次取得的有效ticker，要求行情ts也在窗口内、相对获取时间不超过120秒；不回填或外推。':'Yahoo Finance 指定纽约交易日未复权日线close，收盘后20分钟开始获取；Nasdaq同日historical close交叉核验，差异超过0.1%拒绝结算；两源任一缺失则等待。',tiePolicy:'no',basis:mode==='sprint'?'USDT-perpetual-last':'unadjusted-USD-close'};
  const ai=await forecast(question,mode,source.evidence);if(Date.now()>=Date.parse(rules.lockAt)-10000)throw Error('AI准备时间超过封盘窗口，请重新发起');
  const aiProof=seal({rules,prediction:ai});const r:Round={id:randomUUID(),owner,createdAt:new Date().toISOString(),status:'open',rules,evidence:source.evidence,traces:source.traces,ai,aiHash:aiProof.hash,aiSalt:aiProof.salt,human:null,humanHash:null,humanSalt:null,result:null,public:false,alias:'匿名挑战者',nextAttemptAt:null,attempts:0,error:null};insertRound(r);return r;
 }finally{inflight--;}
}
export function commitRound(id:string,owner:string,input:unknown){
 const v=commitSchema.parse(input),conn=db();conn.exec('BEGIN IMMEDIATE');try{
  const r=getRound(id);if(!r||r.owner!==owner)throw Error('挑战不存在或不属于当前访客');if(r.human)throw Error('已封存，不能覆盖原判断');if(r.status!=='open'||Date.now()>=Date.parse(r.rules.lockAt))throw Error('已过封盘时间，不能提交');
  r.human={probability:v.probability,thesis:v.thesis,evidenceIds:[],caveats:['用户独立判断；未被系统认定为事实。'],submittedAt:new Date().toISOString()};const p=seal({rules:r.rules,prediction:r.human});r.humanHash=p.hash;r.humanSalt=p.salt;r.public=v.public;r.alias=v.alias;r.status='locked';saveRound(r);event(r.id,'human-sealed',{hash:r.humanHash,public:r.public});conn.exec('COMMIT');return r;
 }catch(e){conn.exec('ROLLBACK');throw e;}
}
export function view(r:Round,owner:string){
 const mine=r.owner===owner,reveal=Boolean(r.human)||Date.now()>=Date.parse(r.rules.lockAt);
 return {id:r.id,createdAt:r.createdAt,status:r.status==='open'&&Date.now()>=Date.parse(r.rules.lockAt)?'locked':r.status,rules:r.rules,evidence:r.evidence,traces:r.traces,ai:reveal?r.ai:null,aiHash:r.aiHash,aiSalt:reveal?r.aiSalt:null,human:r.human,humanHash:r.humanHash,humanSalt:r.humanSalt,result:r.result,public:r.public,alias:r.alias,mine,error:r.error,attempts:r.attempts,proof:reveal?{aiValid:verifySeal({rules:r.rules,prediction:r.ai},r.aiSalt,r.aiHash),humanValid:r.human?verifySeal({rules:r.rules,prediction:r.human},r.humanSalt!,r.humanHash!):null}:null};
}
export function assess(r:Round,terminal:Quote,at=new Date()):Result{
 if(at.getTime()<Date.parse(r.rules.settleAt))throw Error('尚未到期');if(at.getTime()>Date.parse(r.rules.expiresAt))throw Error('核验窗口已关闭');
 const base=r.rules.baseline;
 if(terminal.symbol!==base.symbol||terminal.instrument!==base.instrument||terminal.currency!==base.currency||!Number.isFinite(terminal.price)||terminal.price<=0)throw Error('结算标的或价格不匹配');
 if(r.rules.mode==='sprint'){
  const observed=Date.parse(terminal.observedAt),retrieved=Date.parse(terminal.retrievedAt),target=Date.parse(r.rules.settleAt),end=Date.parse(r.rules.expiresAt);
  if(!Number.isFinite(observed)||!Number.isFinite(retrieved)||observed<target||observed>end||retrieved<observed||retrieved>end||retrieved-observed>120000)throw Error('行情不在事前约定的核验窗口');
 }else if(terminal.sessionDate!==r.rules.targetDate||Date.parse(terminal.observedAt)>at.getTime()-1200000)throw Error('收盘交易日或等待时间不符合规则');
 const outcome=terminal.price>base.price?1:0,aiBrier=brier(r.ai.probability,outcome),humanBrier=r.human?brier(r.human.probability,outcome):null;
 return{outcome,terminal,delta:(terminal.price/base.price-1)*100,aiBrier,humanBrier,winner:humanBrier===null?'unopposed':Math.abs(humanBrier-aiBrier)<1e-10?'tie':humanBrier<aiBrier?'human':'ai',resolvedAt:at.toISOString(),evidence:[]};
}
const settling=new Set<string>();
export async function settleRound(id:string){
 const r=getRound(id);if(!r)throw Error('挑战不存在');if(['settled','unresolved','expired'].includes(r.status))return r;
 if(Date.now()<Date.parse(r.rules.settleAt))return r;if(settling.has(id))return r;settling.add(id);
 try{
  if(Date.now()>Date.parse(r.rules.expiresAt)){r.status='unresolved';r.error='约定核验窗口内未取得合格数据；本场不计分';saveRound(r);event(id,'unresolved',{reason:r.error});return r;}
  let terminal:Quote;const settlementEvidence=[];
  if(r.rules.mode==='sprint'){
   const sdk=await bitgetSnapshot(r.rules.symbol);if(!sdk.quote)throw Error('Bitget当前未返回合格报价');terminal=sdk.quote;settlementEvidence.push(...sdk.evidence.map(e=>({...e,role:'settlement' as const})));
  }else{
   const [daily,check]=await Promise.all([nativeDaily(r.rules.symbol,false),nasdaqClose(r.rules.symbol,r.rules.targetDate!)]);
   const split=(daily.raw?.chart?.result?.[0]?.events?.splits||{});if(Object.values(split).some((s:any)=>new Date(s.date*1000).toISOString().slice(0,10)===r.rules.targetDate))throw Error('目标交易日存在拆股，当前价格比较规则不适用');
   const q=daily.quotes.find(q=>q.sessionDate===r.rules.targetDate);if(!q)throw Error('目标交易日日线尚未取得');if(Math.abs(q.price-check.value)/q.price>0.001)throw Error('两源收盘差异超过0.1%，等待核验');terminal=q;
   settlementEvidence.push(evidence('settlement-yahoo','Yahoo 精确交易日日线',daily.url,q,q.observedAt,'settlement'),evidence('settlement-nasdaq','Nasdaq 同日收盘交叉核验',check.url,check.raw,q.observedAt,'settlement'));
  }
  const result=assess(r,terminal);result.evidence=settlementEvidence;
  // A concurrent human submission must not be overwritten by an older read.
  const current=getRound(id)!;if(current.result)return current;result.humanBrier=current.human?brier(current.human.probability,result.outcome):null;result.winner=result.humanBrier===null?'unopposed':Math.abs(result.humanBrier-result.aiBrier)<1e-10?'tie':result.humanBrier<result.aiBrier?'human':'ai';current.result=result;current.status='settled';current.error=null;current.attempts++;saveRound(current);event(id,'settled',{outcome:result.outcome,terminal:result.terminal,aiBrier:result.aiBrier,humanBrier:result.humanBrier});return current;
 }catch(e){const current=getRound(id)!;if(current.result)return current;current.status='locked';current.error=e instanceof Error?e.message:'数据核验失败';current.attempts++;current.nextAttemptAt=new Date(Date.now()+(current.rules.mode==='sprint'?15000:300000)).toISOString();saveRound(current);event(id,'settlement-pending',{reason:current.error,attempt:current.attempts});return current;
 }finally{settling.delete(id);}
}
