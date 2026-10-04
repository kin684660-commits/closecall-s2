import {access,sameOrigin} from '@/lib/access';
import {rounds} from '@/lib/store';
import {createRound,view} from '@/lib/arena';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=90;
export async function GET(req:Request){try{const a=access(req);return Response.json({rounds:rounds(a.owner).map(r=>view(r,a.owner))},{headers:a.headers});}catch{return Response.json({error:'会话配置不可用'},{status:503});}}
export async function POST(req:Request){const a=access(req);try{sameOrigin(req);if(Number(req.headers.get('content-length')||0)>10000)throw Error('请求太大');const r=await createRound(a.owner,await req.json());return Response.json(view(r,a.owner),{status:201,headers:a.headers});}catch(e){return Response.json({error:e instanceof Error?e.message:'挑战准备失败'},{status:400,headers:a.headers});}}
