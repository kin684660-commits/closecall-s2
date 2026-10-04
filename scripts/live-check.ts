import {context} from '../lib/market';
async function main(){const results=[];for(const symbol of ['NVDA','AAPL','MSFT','TSLA','AMZN','META']){const start=Date.now();try{const r=await context(symbol,'sprint');results.push({symbol,ok:true,price:r.baseline.price,observedAt:r.baseline.observedAt,evidence:r.evidence.length,traces:r.traces,ms:Date.now()-start});}catch(e){results.push({symbol,ok:false,error:(e as Error).message,ms:Date.now()-start});}}console.log(JSON.stringify({at:new Date().toISOString(),results},null,2));

}main().catch(e=>{console.error(e.message);process.exitCode=1});
