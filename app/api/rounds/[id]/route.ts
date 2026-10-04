import {access} from '@/lib/access';import {getRound,audit} from '@/lib/store';import {view} from '@/lib/arena';
export const dynamic='force-dynamic';
export async function GET(req:Request,ctx:{params:Promise<{id:string}>}){const a=access(req),{id}=await ctx.params,r=getRound(id);if(!r||(!r.public&&r.owner!==a.owner))return Response.json({error:'挑战不存在或未公开'},{status:404,headers:a.headers});return Response.json({...view(r,a.owner),audit:audit(id)},{headers:a.headers});}
