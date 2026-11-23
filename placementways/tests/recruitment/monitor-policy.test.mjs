import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shouldQueueRecruitmentProposal} from '../../src/server/recruitment/monitor-policy.ts';

test('first scan without validated facts stays a baseline, not a news post',()=>{
  assert.equal(shouldQueueRecruitmentProposal({sourceChanged:false,fieldChangeCount:0,discoveryCount:0}),false);
});
test('first scan can propose existing role or round fields with evidence',()=>{
  assert.equal(shouldQueueRecruitmentProposal({sourceChanged:false,fieldChangeCount:2,discoveryCount:0}),true);
});
test('first scan can propose a genuinely new role or drive',()=>{
  assert.equal(shouldQueueRecruitmentProposal({sourceChanged:false,fieldChangeCount:0,discoveryCount:1}),true);
});
test('any changed source enters human review even when AI is unavailable',()=>{
  assert.equal(shouldQueueRecruitmentProposal({sourceChanged:true,fieldChangeCount:0,discoveryCount:0}),true);
});
test('AI extraction recovering on unchanged fingerprint can enrich earlier review',()=>{
  assert.equal(shouldQueueRecruitmentProposal({sourceChanged:false,fieldChangeCount:1,discoveryCount:0}),true);
});
test('unchanged source without new proposals does not spam the admin queue',()=>{
  assert.equal(shouldQueueRecruitmentProposal({sourceChanged:false,fieldChangeCount:0,discoveryCount:0}),false);
});
