import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {sha,canonical} from './proof';
import type {Round} from './types';
let singleton:DatabaseSync;
export function db(){
 if(singleton)return singleton;
 const path=resolve(process.env.CLOSECALL_DB_PATH||'./data/closecall.sqlite');mkdirSync(dirname(path),{recursive:true});
 singleton=new DatabaseSync(path);singleton.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS rounds (id TEXT PRIMARY KEY,owner TEXT NOT NULL,created_at TEXT NOT NULL,status TEXT NOT NULL,public INTEGER NOT NULL DEFAULT 0,body TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY AUTOINCREMENT,round_id TEXT NOT NULL,at TEXT NOT NULL,kind TEXT NOT NULL,body TEXT NOT NULL,previous TEXT NOT NULL,hash TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS quota (day TEXT NOT NULL,owner TEXT NOT NULL,count INTEGER NOT NULL,last_at INTEGER NOT NULL,PRIMARY KEY(day,owner));
 DROP TRIGGER IF EXISTS immutable_round;
 CREATE TRIGGER immutable_round BEFORE UPDATE ON rounds WHEN
 json_extract(OLD.body,'$.rules') IS NOT json_extract(NEW.body,'$.rules') OR
 json_extract(OLD.body,'$.ai') IS NOT json_extract(NEW.body,'$.ai') OR
 json_extract(OLD.body,'$.aiSalt') IS NOT json_extract(NEW.body,'$.aiSalt') OR
 (json_extract(OLD.body,'$.human') IS NOT NULL AND json_extract(OLD.body,'$.human') IS NOT json_extract(NEW.body,'$.human')) OR
 (json_extract(OLD.body,'$.result') IS NOT NULL AND json_extract(OLD.body,'$.result') IS NOT json_extract(NEW.body,'$.result'))
 BEGIN SELECT RAISE(ABORT,'Sealed payload cannot be changed'); END;
 CREATE TRIGGER IF NOT EXISTS no_event_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT,'Append-only audit'); END;
 CREATE TRIGGER IF NOT EXISTS no_event_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT,'Append-only audit'); END;`);return singleton;
}
export function event(id:string,kind:string,payload:unknown){const conn=db();const previous=(conn.prepare('SELECT hash FROM events ORDER BY seq DESC LIMIT 1').get() as any)?.hash||'GENESIS';const at=new Date().toISOString();const body=canonical(payload);const hash=sha(canonical({roundId:id,kind,at,body,previous}));conn.prepare('INSERT INTO events(round_id,at,kind,body,previous,hash) VALUES(?,?,?,?,?,?)').run(id,at,kind,body,previous,hash);return hash;}
export function insertRound(r:Round){db().prepare('INSERT INTO rounds VALUES(?,?,?,?,?,?)').run(r.id,r.owner,r.createdAt,r.status,r.public?1:0,JSON.stringify(r));event(r.id,'ai-sealed',{rules:r.rules,hash:r.aiHash});}
export function getRound(id:string){const row=db().prepare('SELECT body FROM rounds WHERE id=?').get(id) as any;return row?JSON.parse(row.body) as Round:null;}
export function saveRound(r:Round){db().prepare('UPDATE rounds SET status=?,public=?,body=? WHERE id=?').run(r.status,r.public?1:0,JSON.stringify(r),r.id);}
export function rounds(owner:string){return (db().prepare('SELECT body FROM rounds WHERE owner=? OR public=1 ORDER BY created_at DESC LIMIT 60').all(owner) as any[]).map(x=>JSON.parse(x.body) as Round);}
export function due(){return (db().prepare("SELECT body FROM rounds WHERE status IN ('open','locked') ORDER BY created_at LIMIT 100").all() as any[]).map(x=>JSON.parse(x.body) as Round).filter(r=>Date.parse(r.rules.settleAt)<=Date.now()&&(!r.nextAttemptAt||Date.parse(r.nextAttemptAt)<=Date.now()));}
export function reserve(owner:string){
 const conn=db(),day=new Date().toISOString().slice(0,10);conn.exec('BEGIN IMMEDIATE');
 try{const total=(conn.prepare('SELECT SUM(count) AS n FROM quota WHERE day=?').get(day) as any)?.n||0;const own=conn.prepare('SELECT count,last_at FROM quota WHERE day=? AND owner=?').get(day,owner) as any;
  const limit=Number(process.env.CLOSECALL_MAX_DAILY_CALLS||30);if(!Number.isInteger(limit)||limit<1||total>=limit)throw Error('今日模型调用额度已用完，请明天再来');
  if(own&&Date.now()-own.last_at<60000)throw Error('请等待一分钟再发起新挑战');if(own?.count>=6)throw Error('每位访客每天最多发起 6 场挑战');
  conn.prepare('INSERT INTO quota VALUES(?,?,1,?) ON CONFLICT(day,owner) DO UPDATE SET count=count+1,last_at=excluded.last_at').run(day,owner,Date.now());conn.exec('COMMIT');
 }catch(e){conn.exec('ROLLBACK');throw e;}
}
export function audit(id:string){return db().prepare('SELECT seq,at,kind,body,previous,hash FROM events WHERE round_id=? ORDER BY seq').all(id);}
