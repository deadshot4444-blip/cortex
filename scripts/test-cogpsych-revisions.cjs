/* Revision bookkeeping and self-contained wording guards for the Cognitive Psychology practice bank. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const bank=JSON.parse(fs.readFileSync('data/cogpsych-bank.json')),revisions=JSON.parse(fs.readFileSync('data/cogpsych-revisions.json'));
const byId=new Map(bank.map(q=>[q.id,q]));
const passes=[revisions,...(revisions.followUpPasses||[])];
test('every revised item keeps its id and answer, records its prior wording, and carries uniform review metadata',()=>{
  const snapshotIds=new Set(passes.flatMap(pass=>pass.previousItems.map(q=>q.id)));
  for(const q of bank.filter(q=>q.revision>1)){
    assert.ok(snapshotIds.has(q.id),`${q.id} is revised but has no prior wording in cogpsych-revisions.json`);
    assert.match(String(q.sourceCheckedOn||''),/^\d{4}-\d{2}-\d{2}$/,`${q.id} missing or malformed sourceCheckedOn`);
    assert.equal(q.reviewStatus,'Assistant correction; independent review pending.',`${q.id} missing reviewStatus`);
  }
  for(const pass of passes)for(const prior of pass.previousItems){
    const current=byId.get(prior.id);assert.ok(current,`${prior.id} snapshot has no bank item`);
    assert.equal(current.answer,prior.answer,`${prior.id} answer index must stay comparable`);
    assert.ok(current.revision>1,`${prior.id} has a snapshot but no bumped revision`);
    assert.notEqual(current.q+current.explain+current.hint,prior.q+prior.explain+prior.hint,`${prior.id} snapshot equals current wording`);
  }
});
test('rewritten practice items no longer point at figures, colored lines, or lesson context the practice view never renders',()=>{
  const phantom=/\b(the|this) [\w-]+( [\w-]+)? (figure|diagram|graph)\b|\b(figure|diagram|graph) (showed|shows)\b|\b(orange|red|blue) [\w-]* ?(lines?|curves?)\b|\bin this lesson\b|\bin the study described\b/i;
  for(const id of ['cog-m2-ch6-007','cog-m2-ch6-030','cog-m2-ch6-056','cog-m2-ch6-071','cog-m2-ch7-058','cog-m2-ch9-027','cog-c01-003','cog-m2-ch6-022']){
    const q=byId.get(id);assert.ok(q,id);
    for(const field of ['q','hint','explain'])assert.doesNotMatch(q[field],phantom,`${id}.${field}`);
  }
});
