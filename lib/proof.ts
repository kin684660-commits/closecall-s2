import { createHash,randomBytes } from 'node:crypto';
export function canonical(value:unknown):string { if(value===null||typeof value!=='object') return JSON.stringify(value); if(Array.isArray(value))return '['+value.map(canonical).join(',')+']'; return '{'+Object.keys(value as object).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}'; }
export const sha=(text:string)=>createHash('sha256').update(text).digest('hex');
export function seal(value:unknown,salt=randomBytes(24).toString('hex')) { return {salt,hash:sha(canonical({value,salt}))}; }
export function verifySeal(value:unknown,salt:string,hash:string){return sha(canonical({value,salt}))===hash;}
export function brier(p:number,y:0|1){if(!Number.isFinite(p)||p<0||p>1)throw Error('Invalid probability');return (p-y)**2;}
