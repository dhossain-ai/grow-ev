import { readFile } from 'node:fs/promises';
const receipt=JSON.parse(await readFile(process.env.GROW_EV_COLLECTION_RECEIPT,'utf8'));
if (!/^[0-9a-f-]{36}$/.test(receipt.poll_id) || !receipt.history?.payload_sha256) throw Error('Missing verified receipt');
if (!process.env.GROW_EV_AI_DISPATCH_TOKEN) throw Error('AI dispatch secret missing');
// No retry: an ambiguous POST may already have started inference. Next poll provides recovery.
try {
  const response=await fetch('https://api.github.com/repos/dhossain-ai/grow-ev-ai/actions/workflows/predict.yml/dispatches',{
    method:'POST',headers:{Authorization:`Bearer ${process.env.GROW_EV_AI_DISPATCH_TOKEN}`,'User-Agent':'grow-ev-collector',Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},
    body:JSON.stringify({ref:'main',inputs:{mode:'dry-run',source_poll_id:receipt.poll_id}}),signal:AbortSignal.timeout(15000),redirect:'error'});
  if(response.status!==204)throw Error('Dispatch rejected');
  console.log(JSON.stringify({inference_dispatch:'accepted',poll_id:receipt.poll_id,publication:false}));
} catch { throw Error('Inference dispatch failed or uncertain; do not blindly retry'); }
