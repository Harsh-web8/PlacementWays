// No database, network, or AI key required. Run: node --experimental-strip-types --test tests/recruitment/discovery-core.test.mjs
import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {buildDiscoveryCandidatesValidated,roleSlug,normalizedName} from '../../src/server/recruitment/discovery-core.ts';
const COMPANY='11111111-1111-1111-1111-111111111111';
const ROLE='22222222-2222-2222-2222-222222222222';
const DRIVE='33333333-3333-3333-3333-333333333333';
const role={id:ROLE,company_id:COMPANY,title:'Associate Software Engineer',slug:'associate-software-engineer'};
const drive={id:DRIVE,role_id:ROLE,title:'2026 Graduate Hiring'};
const context=(x={})=>({companyId:COMPANY,roleId:null,driveId:null,roles:[role],drives:[drive],...x});
const quote='Applications are open for 2027 Graduate Hiring for the Associate Software Engineer role.';

test('normalizes case and punctuation consistently',()=>{
 assert.equal(normalizedName('  Associate---Software ENGINEER  '),'associate software engineer');
 assert.equal(roleSlug('Associate / Software Engineer'),'associate-software-engineer');
});
test('proposes a new role and optional hiring drive from exact evidence',()=>{
 const evidence='Official graduate program introduces a Quality Engineer role and 2027 Graduate Program recruitment.';
 const records=buildDiscoveryCandidatesValidated([{kind:'role',role:{title:'Quality Engineer'},drive:{title:'2027 Graduate Program',hiring_year:2027},evidence_quote:evidence}],evidence,context());
 assert.equal(records.length,1);assert.equal(records[0].kind,'role');assert.equal(records[0].parent_role_id,null);
 assert.equal(records[0].payload.drive.title,'2027 Graduate Program');
});
test('matches a known role and permits its new drive',()=>{
 const records=buildDiscoveryCandidatesValidated([{kind:'drive',role_title:'Associate Software Engineer',drive:{title:'2027 Graduate Hiring',hiring_year:2027},evidence_quote:quote}],quote,context());
 assert.equal(records.length,1);assert.equal(records[0].kind,'drive');assert.equal(records[0].parent_role_id,ROLE);
});
test('never suggests a duplicate role or hiring drive',()=>{
 assert.equal(buildDiscoveryCandidatesValidated([{kind:'role',role:{title:'Associate Software Engineer'},evidence_quote:quote}],quote,context()).length,0);
 const duplicate='Applications are open for 2026 Graduate Hiring for the Associate Software Engineer role.';
 assert.equal(buildDiscoveryCandidatesValidated([{kind:'drive',role_title:'Associate Software Engineer',drive:{title:'2026 Graduate Hiring'},evidence_quote:duplicate}],duplicate,context()).length,0);
});
test('rejects quotes not present in the source',()=>{
 assert.equal(buildDiscoveryCandidatesValidated([{kind:'drive',role_title:role.title,drive:{title:'2027 Graduate Hiring'},evidence_quote:quote}], 'This page has no recruitment details.',context()).length,0);
});
test('role-scoped source cannot suggest new roles or another role’s drive',()=>{
 const records=buildDiscoveryCandidatesValidated([{kind:'role',role:{title:'Quality Engineer'},evidence_quote:quote},{kind:'drive',role_title:'Quality Engineer',drive:{title:'2027 Graduate Hiring'},evidence_quote:quote}],quote,context({roleId:ROLE}));
 assert.equal(records.length,0);
});
test('drive-scoped sources cannot create additional roles or drives',()=>{
 assert.equal(buildDiscoveryCandidatesValidated([{kind:'drive',role_title:role.title,drive:{title:'2027 Graduate Hiring'},evidence_quote:quote}],quote,context({roleId:ROLE,driveId:DRIVE})).length,0);
});
test('does not map an unknown role to an arbitrary existing role',()=>{
 assert.equal(buildDiscoveryCandidatesValidated([{kind:'drive',role_title:'Developer',drive:{title:'2027 Hiring'},evidence_quote:quote}],quote,context()).length,0);
});
test('deduplicates identical suggestions within a single scan',()=>{
 const item={kind:'drive',role_title:role.title,drive:{title:'2027 Graduate Hiring'},evidence_quote:quote};
 assert.equal(buildDiscoveryCandidatesValidated([item,item],quote,context()).length,1);
});
