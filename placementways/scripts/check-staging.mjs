import {assessStagingConfiguration} from './lib/staging-config-core.mjs';
const {blockers,warnings}=assessStagingConfiguration(process.env,{
  requireAi:process.argv.includes('--require-ai'),
  requireCoding:process.argv.includes('--require-coding'),
  vercelPreview:process.argv.includes('--vercel-preview'),
});
for(const item of blockers)console.error(`BLOCKED: ${item}`);
for(const item of warnings)console.warn(`WARNING: ${item}`);
if(blockers.length){
  console.error(`Staging configuration blocked (${blockers.length} issue(s)). No credentials were printed.`);
  process.exitCode=1;
}else console.log('Staging configuration looks ready for live integration checks. This does NOT validate database isolation, migrations, source permissions or end-to-end behavior.');
