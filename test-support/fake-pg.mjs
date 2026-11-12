import {EventEmitter} from 'node:events';
// Only the external database is simulated. Real SQL is checked separately by check:storage.
export function databaseFixture(){
 const db={state:null,owner:null,failWrite:false,loseWriteAck:false,clients:[]};
 class Client extends EventEmitter{
  constructor(){super();db.clients.push(this);}
  async connect(){}
  async query(sql,values){
   if(sql.includes('pg_try_advisory_lock')){const locked=!db.owner||db.owner===this;if(locked)db.owner=this;return {rows:[{locked}]};}
   if(sql.includes('pg_terminate_backend')){const old=db.owner;if(old&&old!==this){db.owner=null;old.emit('error',Error('terminated by administrator'));}return {rows:[]};}
   if(sql.startsWith('CREATE TABLE'))return {rows:[]};
   if(sql.startsWith('INSERT INTO')){db.state??=JSON.parse(values[0]);return {rows:[]};}
   if(sql.startsWith('SELECT state'))return {rows:[{state:structuredClone(db.state)}]};
   if(sql.startsWith('UPDATE')){if(db.failWrite)throw Error('Connection lost including a private connection detail');db.state=JSON.parse(values[0]);if(db.loseWriteAck)throw Error('Acknowledgement lost after commit');return {rowCount:1,rows:[]};}
   throw Error('Unexpected database query in test');
  }
  async end(){if(db.owner===this)db.owner=null;this.emit('end');}
 }
 return {db,Client};
}
