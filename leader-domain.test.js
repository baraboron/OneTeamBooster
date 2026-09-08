const {test}=require('node:test');
const assert=require('node:assert/strict');
const D=require('./leader-domain.js');
const members=[{id:'m',groupId:'g'},{id:'outsider',groupId:'other'},{id:'lead',groupId:'g'}];
const records=[{id:'r',recipientId:'m'},{id:'other',recipientId:'outsider'},{id:'self',recipientId:'lead'}];

test('leader can view only praise received by members in the assigned group',()=>{
 const session={role:'leader',userId:'lead',groupId:'g'};
 assert.deepEqual(D.scopedRecords(session,members,records),[records[0],records[2]]);
 assert.deepEqual(D.scopedRecords({...session,role:'member'},members,records),[]);
});
