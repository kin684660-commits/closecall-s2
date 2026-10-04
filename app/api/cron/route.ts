import {cronAuthorized} from '@/lib/access';import {due} from '@/lib/store';import {settleRound} from '@/lib/arena';
export const dynamic='force-dynamic';
export async function POST(req:Request){if(!cronAuthorized(req))return Response.json({error:'Unauthorized'},{status:401});const list=due().slice(0,6);const results=[];for(const r of list){const next=await settleRound(r.id);results.push({id:r.id,status:next.status,error:next.error});}return Response.json({checked:results.length,results});}
