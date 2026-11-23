import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessReviewDate, assessDriveLabel, buildRecruitmentQualityReport } from '../../src/lib/recruitment-quality.ts';
const now=new Date('2026-11-23T12:00:00.000Z');
const base={
 companies:[{id:'c',name:'Sample Employer',slug:'sample',status:'published'}],
 roles:[{id:'r',company_id:'c',title:'Engineer',slug:'engineer',status:'published',source_url:'https://example.com/role',last_verified_at:'2026-11-22T12:00:00Z'}],
 drives:[{id:'d',role_id:'r',title:'2027 graduates',status:'published',source_url:'https://example.com/drive',last_verified_at:'2026-11-22T12:00:00Z'}],
 rounds:[{id:'a',drive_id:'d',source_url:'https://example.com/round'}],
 sources:[{id:'s',company_id:'c',label:'Careers',enabled:true,last_success_at:'2026-11-22T12:00:00Z',last_error:null}],
};
const clone=(x)=>structuredClone(x);
test('recent review is not described as official verification',()=>{
 const value=assessReviewDate('2026-11-22T12:00:00Z',now);
 assert.equal(value.state,'recent');assert.match(value.label,/Last reviewed/);assert.doesNotMatch(value.label,/verified|confirmed/i);
});
test('missing, invalid and future review dates are unknown',()=>{
 for(const date of [null,'garbage','2026-12-01T12:00:00Z'])assert.equal(assessReviewDate(date,now).state,'unknown');
});
test('review older than 30 days is flagged',()=>assert.equal(assessReviewDate('2026-10-01T12:00:00Z',now).state,'stale'));
test('status cannot claim an expired open deadline is current',()=>{
 assert.equal(assessDriveLabel('open','2026-11-01T12:00:00Z',now).warning,true);
 assert.match(assessDriveLabel('open','2026-11-01T12:00:00Z',now).label,/deadline passed/);
});
test('open without a deadline explicitly recommends source checking',()=>assert.match(assessDriveLabel('open',null,now).label,/verify source/));
test('complete sourced example does not have gaps',()=>{
 const report=buildRecruitmentQualityReport(base,now);
 assert.equal(report.summary.issues,0);assert.equal(report.summary.rounds,1);
});
test('missing source and incomplete guides show targeted actions',()=>{
 const incomplete=clone(base);incomplete.sources=[];incomplete.roles=[];incomplete.drives=[];incomplete.rounds=[];
 const report=buildRecruitmentQualityReport(incomplete,now);
 assert.deepEqual(report.issues.map(i=>i.key),['roles:c','source:c']);
});
test('stale guide and erroring monitor are surfaced',()=>{
 const input=clone(base);input.roles[0].last_verified_at='2026-01-01T00:00:00Z';input.sources[0].last_error='Timeout';
 assert.deepEqual(buildRecruitmentQualityReport(input,now).issues.map(i=>i.key),['role-review:r','source-error:s']);
});
test('draft records do not count as published coverage',()=>{
 const input=clone(base);input.drives[0].status='draft';
 const report=buildRecruitmentQualityReport(input,now);
 assert.equal(report.summary.drives,0);
 assert.ok(report.issues.some(i=>i.key==='drive:r'));
});
test('rounds without source links are flagged for editorial review',()=>{
 const input=clone(base);input.rounds[0].source_url=null;
 assert.ok(buildRecruitmentQualityReport(input,now).issues.some(i=>i.key==='round-source:a'));
});
