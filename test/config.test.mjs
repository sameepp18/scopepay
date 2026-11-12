import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {loadConfig} from '../lib/config.mjs';
async function config(t,env){const dir=await mkdtemp(join(tmpdir(),'scopepay-config-'));t.after(()=>rm(dir,{recursive:true,force:true}));return loadConfig(dir,env);}
test('explicit Postgres storage rejects a missing URL instead of starting an empty file store',async t=>{await assert.rejects(()=>config(t,{STORAGE_MODE:'postgres'}),/DATABASE_URL/);});
test('file storage cannot silently ignore a supplied database',async t=>{await assert.rejects(()=>config(t,{STORAGE_MODE:'file',DATABASE_URL:'postgres://private'}),/storage|DATABASE_URL/i);});
test('unsupported storage mode is rejected',async t=>{await assert.rejects(()=>config(t,{STORAGE_MODE:'typo'}),/STORAGE_MODE/);});
test('local default remains file storage and database auto mode selects Postgres',async t=>{assert.equal((await config(t,{})).storageMode,'file');assert.equal((await config(t,{DATABASE_URL:'postgres://private'})).storageMode,'postgres');});
