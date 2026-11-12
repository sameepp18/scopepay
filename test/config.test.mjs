import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {loadConfig} from '../lib/config.mjs';
async function config(t,env){const dir=await mkdtemp(join(tmpdir(),'scopepay-config-'));t.after(()=>rm(dir,{recursive:true,force:true}));return loadConfig(dir,env);}
test('explicit Postgres storage rejects a missing URL instead of starting an empty file store',async t=>{await assert.rejects(()=>config(t,{STORAGE_MODE:'postgres'}),/DATABASE_URL/);});
test('file storage cannot silently ignore a supplied database',async t=>{await assert.rejects(()=>config(t,{STORAGE_MODE:'file',DATABASE_URL:'postgres://private'}),/storage|DATABASE_URL/i);});
test('unsupported storage mode is rejected',async t=>{await assert.rejects(()=>config(t,{STORAGE_MODE:'typo'}),/STORAGE_MODE/);});
test('local default remains file storage and database auto mode selects Postgres',async t=>{assert.equal((await config(t,{})).storageMode,'file');assert.equal((await config(t,{DATABASE_URL:'postgres://private'})).storageMode,'postgres');});
test('a Groq key selects the free Groq provider and its default model; Anthropic stays available',async()=>{
 const g=await loadConfig('/nonexistent-scopepay-dir',{GROQ_API_KEY:'k'});assert.equal(g.aiProvider,'groq');assert.equal(g.model,'openai/gpt-oss-120b');
 const m=await loadConfig('/nonexistent-scopepay-dir',{GROQ_API_KEY:'k',AI_MODEL:'qwen/x'});assert.equal(m.model,'qwen/x');
 const a=await loadConfig('/nonexistent-scopepay-dir',{ANTHROPIC_API_KEY:'k'});assert.equal(a.aiProvider,'anthropic');assert.match(a.model,/claude/);
 await assert.rejects(loadConfig('/nonexistent-scopepay-dir',{AI_PROVIDER:'openai'}),/AI_PROVIDER/);});
