import {sha} from './proof';
import {sessionFor,nyDate} from './calendar';
import type {Quote,Evidence,Round} from './types';
const ua='CloseCall/0.1 public research';
export function evidence(id:string,title:string,url:string,data:unknown,observedAt:string|null,role:Evidence['role']='context',warnings:string[]=[]):Evidence{const text=typeof data==='string'?data:JSON.stringify(data);return{id,title,url,text,retrievedAt:new Date().toISOString(),observedAt,hash:sha(text),role,warnings};}
async function json(url:string){const r=await fetch(url,{headers:{'User-Agent':ua,Accept:'application/json'},signal:AbortSignal.timeout(14000),cache:'no-store'});if(!r.ok)throw Error(`数据服务 HTTP ${r.status}`);return r.json();}
export function parseDaily(symbol:string,body:any){
 const r=body.chart?.result?.[0],m=r?.meta;
 if(m?.symbol!==symbol||m?.instrumentType!=='EQUITY'||m?.currency!=='USD'||!['NMS','NGM','NCM','NYQ'].includes(m.exchangeName))throw Error('原生股票身份未通过核验');
 const close=r.indicators?.quote?.[0]?.close||[];
 return (r.timestamp||[]).flatMap((t:number,i:number)=>{
  if(!Number.isFinite(t)||!Number.isFinite(close[i])||close[i]<=0)return [];
  const day=nyDate(new Date(t*1000));const session=sessionFor(day);if(!session)return [];
  return [{symbol,instrument:'equity' as const,currency:'USD',price:close[i],observedAt:session.close.toISOString(),retrievedAt:new Date().toISOString(),sessionDate:day,provider:'Yahoo Finance · daily unadjusted close',url:`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1mo&events=div%2Csplits`,warnings:['日线 close 字段，使用纽约交易日映射收盘；不是原始逐笔成交时间。','公共数据可能延迟或修订；收盘后至少等待20分钟，报价不代表可执行价格。'] }];
 }) as Quote[];
}
export function parseNasdaqDaily(symbol:string,body:any,url:string){
 if(body?.data?.symbol!==symbol)throw Error('Nasdaq 标的身份不匹配');
 return (body.data.tradesTable?.rows||[]).flatMap((r:any)=>{
  const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(r.date));if(!m)return [];
  const day=`${m[3]}-${m[1]}-${m[2]}`,session=sessionFor(day),price=Number(String(r.close).replace(/[$,]/g,''));
  if(!session||!Number.isFinite(price)||price<=0)return [];
  return [{symbol,instrument:'equity' as const,currency:'USD',price,observedAt:session.close.toISOString(),retrievedAt:new Date().toISOString(),sessionDate:day,provider:'Nasdaq · historical daily close',url,warnings:['历史表日期级收盘记录，时间由纽约交易日映射；不是原始逐笔成交时间。','备用基准来源；结算仍需 Yahoo 与 Nasdaq 两个来源同时取得，不能用同一来源做两次核验。']}];
 }).sort((a:Quote,b:Quote)=>a.observedAt.localeCompare(b.observedAt)) as Quote[];
}
export async function nativeDaily(symbol:string,allowFallback=true){
 const failures:string[]=[];
 for(const host of ['query1.finance.yahoo.com','query2.finance.yahoo.com']){
  const url=`https://${host}/v8/finance/chart/${symbol}?interval=1d&range=1mo&events=div%2Csplits`;
  try{const body=await json(url);return{quotes:parseDaily(symbol,body),raw:body,url,provider:'yahoo',failures};}catch(e){failures.push(`${host}: ${e instanceof Error?e.message:'Unavailable'}`);}
 }
 if(!allowFallback)throw Error(failures.join('; '));
 const end=new Date().toISOString().slice(0,10),start=new Date(Date.now()-35*86400000).toISOString().slice(0,10);
 const url=`https://api.nasdaq.com/api/quote/${symbol}/historical?assetclass=stocks&fromdate=${start}&todate=${end}&limit=40`;
 const body=await json(url);return{quotes:parseNasdaqDaily(symbol,body,url),raw:body,url,provider:'nasdaq',failures};
}
export function latestCompleted(quotes:Quote[],at=new Date()){return quotes.filter(q=>Date.parse(q.observedAt)+1200000<=at.getTime()).sort((a,b)=>b.observedAt.localeCompare(a.observedAt))[0]||null;}
export async function nasdaqClose(symbol:string,day:string){
 const url=`https://api.nasdaq.com/api/quote/${symbol}/historical?assetclass=stocks&fromdate=${day}&todate=${day}&limit=10`;
 const body=await json(url);if(body?.data?.symbol!==symbol)throw Error('Nasdaq 标的身份不匹配');const row=body?.data?.tradesTable?.rows?.find((r:any)=>{
  const d=new Date(r.date+' 12:00:00 UTC');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===day;
 });const value=Number(String(row?.close||'').replace(/[$,]/g,''));if(!Number.isFinite(value)||value<=0)throw Error('Nasdaq 精确交易日收盘记录缺失');return {value,url,raw:body};
}
export async function bitgetSnapshot(symbol:string){
 const {loadConfig,BitgetRestClient,buildTools,safeInvoke}=await import('@bitget-ai/bitget-agent-sdk');
 const config=loadConfig({modules:'market',readOnly:true,apiKey:'',secretKey:'',passphrase:'',baseUrl:'https://api.bitget.com',timeoutMs:14000});const client=new BitgetRestClient(config),ctx={config,client};const tools=buildTools(config),market=tools.find(t=>t.name==='market')!,discover=tools.find(t=>t.name==='discover')!;
 const pair=symbol+'USDT',args={category:'USDT-FUTURES',symbol:pair};const traces:Round['traces']=[];const items:Evidence[]=[];
 async function invoke(action:string,extra:Record<string,string>={}){
  const start=Date.now();try{
   const contract=await safeInvoke(discover,{tool:'market',action},ctx);if(!contract.ok||(contract.data as any)?.riskLevel!=='read'||(contract.data as any)?.auth!=='public')throw Error('工具未核验为公开只读');
   const response=await safeInvoke(market,{action,...args,...extra},ctx);if(!response.ok)throw Error(response.error.message);if(response.data==null)throw Error('Empty response');
   items.push(evidence(`bitget-${action}`,`Bitget 官方 SDK · ${action}`,`https://api.bitget.com/api/v3/market/${action}?${new URLSearchParams({...args,...extra})}`,response.data,null));traces.push({tool:`Bitget SDK market.${action}`,status:'success',durationMs:Date.now()-start});return response.data as any;
  }catch(e){traces.push({tool:`Bitget SDK market.${action}`,status:'failed',error:e instanceof Error?e.message:'Unavailable',durationMs:Date.now()-start});return null;}
 }
 const instruments=await invoke('instruments');const ins=Array.isArray(instruments)?instruments.find((x:any)=>x.symbol===pair):null;
 if(ins?.baseCoin!==symbol||ins?.symbolType!=='stock'||ins?.category!=='USDT-FUTURES'||ins?.type!=='perpetual'||ins?.status!=='online')return{quote:null,evidence:items,traces};
 const [tickers,candles,book]=await Promise.all([invoke('tickers'),invoke('candles',{interval:'1H',limit:'24'}),invoke('orderbook',{limit:'5'})]);void book;
 const t=Array.isArray(tickers)?tickers.find((x:any)=>x.symbol===pair):null;const price=Number(t?.lastPrice),ts=Number(t?.ts),bid=Number(t?.bid1Price),ask=Number(t?.ask1Price);
 if(!t||!Number.isFinite(price)||price<=0||!Number.isFinite(ts)||ts<=0||Math.abs(Date.now()-ts)>120000||!bid||!ask||bid>ask)return{quote:null,evidence:items,traces:[...traces,{tool:'Bitget quote validation',status:'failed',error:'报价缺失、过期或盘口异常',durationMs:0}]};
 const quote:Quote={symbol:pair,instrument:'stock-perpetual',currency:'USDT',price,observedAt:new Date(ts).toISOString(),retrievedAt:new Date().toISOString(),provider:'Bitget official Agent SDK · market.tickers',url:`https://api.bitget.com/api/v3/market/tickers?${new URLSearchParams(args)}`,bid,ask,candles:Array.isArray(candles)?candles.map((x:any)=>({at:new Date(Number(x[0])).toISOString(),close:Number(x[4])})).filter((x:any)=>Number.isFinite(x.close)&&x.close>0):[],warnings:['股票类 USDT 永续合约，不是原生股票、股权或可赎回代币。','本挑战比较 lastPrice 观测值，不执行交易，不计为真实收益。']};
 return{quote,evidence:items,traces};
}
function rpcParse(text:string){if(text.trim().startsWith('{'))return JSON.parse(text);for(const line of text.split('\n'))if(line.startsWith('data:')){const j=JSON.parse(line.slice(5).trim());if(j.result||j.error)return j;}throw Error('Invalid MCP response');}
export async function mcpContext(symbol:string){let session='',id=1;const start=Date.now(),endpoint='https://agent.bitget.com/mcp';
 async function rpc(method:string,params:unknown){const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',...(session?{'Mcp-Session-Id':session}:{})},body:JSON.stringify({jsonrpc:'2.0',id:id++,method,params}),signal:AbortSignal.timeout(8000)});session=r.headers.get('mcp-session-id')||session;if(!r.ok)throw Error(`MCP HTTP ${r.status}`);const j=rpcParse(await r.text());if(j.error)throw Error('MCP protocol error');return j.result;}
 try{await rpc('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'closecall',version:'0.1.0'}});const guide=await rpc('tools/call',{name:'guide',arguments:{category:'equity'}});const entries=guide.structuredContent?.entries||JSON.parse(guide.content.find((x:any)=>x.type==='text').text).entries;if(!entries.some((x:any)=>x.id==='equity_price_quote'))throw Error('Equity quote catalog missing');const raw=await rpc('tools/call',{name:'do_query',arguments:{entry_id:'equity_price_quote',params:{symbol}}});const body=raw.structuredContent||JSON.parse(raw.content?.find((x:any)=>x.type==='text')?.text||'null');if(raw.isError||!body||body.success===false)throw Error('MCP provider quote unavailable');return{evidence:[evidence('bitget-mcp','Bitget 官方美股 MCP · 研究背景',endpoint,body,null)],trace:{tool:'Bitget MCP equity_price_quote',status:'success',durationMs:Date.now()-start}};
 }catch(e){return{evidence:[],trace:{tool:'Bitget MCP equity_price_quote',status:'failed',error:e instanceof Error?e.message:'Unavailable',durationMs:Date.now()-start}};}
}
export async function context(symbol:string,mode:'close'|'sprint'){
 const traces:Round['traces']=[],items:Evidence[]=[];let baseline:Quote|null=null;
 const sdkPromise=bitgetSnapshot(symbol),mcpPromise=mcpContext(symbol);
 const start=Date.now();try{const daily=await nativeDaily(symbol);const q=latestCompleted(daily.quotes);if(q){items.push(evidence('native-daily','原生美股 · 最近完整交易日日线',daily.url,{latestCompleted:q,history:daily.quotes.slice(-10)},q.observedAt,mode==='close'?'baseline':'context',q.warnings));if(mode==='close')baseline=q;}traces.push(...daily.failures.map(error=>({tool:'Yahoo native daily chart',status:'failed' as const,error,durationMs:0})));traces.push({tool:daily.provider==='yahoo'?'Yahoo native daily chart':'Nasdaq native daily fallback',status:q?'success':'failed',durationMs:Date.now()-start,error:q?undefined:'完整交易日数据缺失'});}catch(e){traces.push({tool:'Yahoo native daily chart',status:'failed',durationMs:Date.now()-start,error:e instanceof Error?e.message:'Unavailable'});}
 const [sdk,mcp]=await Promise.all([sdkPromise,mcpPromise]);items.push(...sdk.evidence,...mcp.evidence);traces.push(...sdk.traces,mcp.trace);if(mode==='sprint')baseline=sdk.quote;
 if(!baseline)throw Error(mode==='sprint'?'真实股票永续报价当前不可用，不能发起加赛':'原生美股完整收盘数据不可用，不能发起收盘挑战；可稍后重试或选择股票永续加赛');
 return{baseline,evidence:items,traces};
}
