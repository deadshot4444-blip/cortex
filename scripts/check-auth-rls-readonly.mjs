// Optional live check. Tokens come from two dedicated test accounts via environment;
// this script sends no sign-in emails and performs no inserts, updates or deletes.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const auth=await fs.readFile(new URL('../auth.js',import.meta.url),'utf8');
const endpoint=auth.match(/const SUPABASE_URL = '([^']+)'/)[1];
const apikey=auth.match(/const SUPABASE_ANON_KEY = '([^']+)'/)[1];
const tokens=[process.env.CORTEX_TEST_ACCOUNT_A_TOKEN,process.env.CORTEX_TEST_ACCOUNT_B_TOKEN];
if(tokens.some(t=>!t))throw Error('Set CORTEX_TEST_ACCOUNT_A_TOKEN and CORTEX_TEST_ACCOUNT_B_TOKEN locally using two dedicated test accounts. Do not paste tokens into reports.');
async function get(path,token){const response=await fetch(endpoint+path,{headers:{apikey,...(token?{Authorization:'Bearer '+token}:{})}});if(!response.ok)throw Error(`Read-only check returned HTTP ${response.status}`);return response.json();}
try{
 const users=await Promise.all(tokens.map(t=>get('/auth/v1/user',t)));
 assert.ok(users.every(u=>typeof u.id==='string'));assert.notEqual(users[0].id,users[1].id,'Use two different test accounts');
 for(let i=0;i<2;i++){
  const own=await get('/rest/v1/progress?select=user_id&user_id=eq.'+encodeURIComponent(users[i].id),tokens[i]);
  assert.equal(own.length,1,'Each dedicated test account needs an existing progress row before this check is conclusive');
  const other=await get('/rest/v1/progress?select=user_id&user_id=eq.'+encodeURIComponent(users[1-i].id),tokens[i]);
  assert.equal(other.length,0,'A test account can read the other account progress row');
 }
 const anonymous=await get('/rest/v1/progress?select=user_id&user_id=in.('+users.map(u=>encodeURIComponent(u.id)).join(',')+')');
 assert.equal(anonymous.length,0,'Anonymous access exposes a test progress row');
 console.log('PASS: both test accounts can read their own existing row; neither can read the other row; anonymous access exposes neither row.');
 console.log('NOT TESTED: cross-account insert/update enforcement, real-device sync, email delivery, or deployed app behavior.');
}catch(error){console.error('FAIL:',error.message);process.exitCode=1;}
