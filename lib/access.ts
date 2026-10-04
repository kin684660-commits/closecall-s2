import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
export function access(req:Request){
 const secret=process.env.CLOSECALL_SESSION_SECRET;if(!secret||secret.length<32)throw Error('服务器尚未配置会话密钥');
 const sign=(p:string)=>createHmac('sha256',secret).update(p).digest('hex');
 const cookie=req.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('closecall-session='))?.slice(18);
 let owner='';if(cookie){const p=cookie.split('.');if(p.length===3&&/^[0-9a-f-]{36}$/.test(p[0])&&/^\d+$/.test(p[1])&&/^[a-f0-9]{64}$/.test(p[2])&&Number(p[1])>Date.now()&&timingSafeEqual(Buffer.from(sign(p.slice(0,2).join('.'))),Buffer.from(p[2])))owner=p[0];}
 const fresh=!owner;if(!owner)owner=randomUUID();const payload=fresh?`${owner}.${Date.now()+30*86400000}`:cookie!.split('.').slice(0,2).join('.');
 return {owner,headers:{'Cache-Control':'no-store','Set-Cookie':`closecall-session=${payload}.${sign(payload)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${new URL(req.url).protocol==='https:'||req.headers.get('x-forwarded-proto')==='https'?'; Secure':''}`}};
}
export function sameOrigin(req:Request){const origin=req.headers.get('origin');if(origin&&new URL(origin).host!==req.headers.get('host'))throw Error('跨站请求被拒绝');}
export function cronAuthorized(req:Request){const secret=process.env.CLOSECALL_CRON_SECRET;if(!secret||secret.length<32)return false;const got=req.headers.get('authorization')||'';const wanted=`Bearer ${secret}`;return got.length===wanted.length&&timingSafeEqual(Buffer.from(got),Buffer.from(wanted));}
