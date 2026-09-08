# Bounded help, local milestone 2.26

The active implementation is authored help. No generative provider, prompt endpoint,
paid inference call or switch that enables one has been added. The milestone's
authored fallback is used because corpus approval, expert evaluation, learner
demand and operating-budget approval are still absent.

## Learner workflow

Seven specified application questions across proteins, enzymes and membrane
transport offer two optional hints after the original answer. Topic IDs alone
cannot retrieve a hint: the question must be in that guide's explicit scope.
Each scoped question has its own support check, separate from the assessment pool.
Other questions retain a general diagnostic check labeled "Related lesson check";
the screen explains that it may test a different distinction.

An optional note is frozen when the first hint opens. Revealed stages and times,
the later editable reflection, the supported check and the original
answer remain separate. Reopening never rescored the original answer. A saved
help button in the learning record returns to that copy. Selected portfolio
evidence preserves the distinction between first writing, opened assistance and
later revision. This does not establish unaided performance elsewhere.

## Content and sources

`data/mcat-course.json` contains three authoredHelp records, each with version 1,
two stages, a fixed source link and an explicit question scope. Across the three
records there are seven question-specific support checks. The saved guide copies only stage titles/text, version and source, plus its own unit/question
identity. The separate support question is copied into questionSnapshot on first
open. Existing saved diagnostic checks keep their exact wording, choice and time
and receive the related-check label. No existing help record is silently replaced.
The guide does not retrieve other questions, their keys, account identifiers,
other learner records or arbitrary imported fields.

- Protein stages: distinguish sequence, folding and subunit association. Source:
  [OpenStax Biology 2e, Proteins](https://openstax.org/books/biology-2e/pages/3-4-proteins),
  Protein Structure and Denaturation. They are not offered for the disulfide or
  side-chain substitution checks, which need different explanations.
- Enzyme stages: compare like substrate concentrations and the limiting rate,
  then apply the stated simple competitive-inhibition model. Source:
  [OpenStax Biology 2e, Enzymes](https://openstax.org/books/biology-2e/pages/6-5-enzymes),
  Molecular Regulation of Enzymes and Figure 6.17. These hints do not claim to
  explain every binding mechanism or teach the separate Km calculation.
- Membrane stages: inspect permeability before inferring movement; distinguish
  water from nonpenetrating solute in an ideal osmosis model. Source:
  [OpenStax Biology 2e, Passive Transport](https://openstax.org/books/biology-2e/pages/5-2-passive-transport),
  Selective Permeability, Osmosis and Tonicity. They are not offered for active
  transport or electrochemical-gradient checks.

These source sections were checked on 2026-09-07 during local authoring and
rechecked for the seven separate support questions after browser inspection found
an osmosis error followed by an unrelated transport diagnostic. Their
links are references, not an endorsement or independent approval of Cortex.
Independent review remains pending and is stated in the help itself.

## Persistence and boundaries

Records stay within cs-mcat-course-v1, under units[unitId].help[questionId].guide.
The original saved content wins over later catalog revisions. Source URLs must
match the three explicit allowed sources; invalid saved guide identity, shape,
version or source retains the original for recovery. All displayed writing is
escaped. The backup's plaintext exception is limited to the escaped help subtree.

The controller checks account/storage freshness before edits. Failed writes hold
drafts in memory, expose recovery, and withhold the newly requested hint/result
until persistence succeeds. Detached page handlers cannot write. Existing account
sync still applies to these records; this is not a device-only storage promise.

“No future answer leakage” means the normal help screen does not render upcoming
question wording or keys. Public static course files are not secure exam storage.
General instructional help can affect later answers; no unaided claim follows.

## Evaluation and future generative gate

`mcat-tutor-evaluation.json` fixes the current decision, candidate evaluation cases
and proposed future thresholds. They are author-proposed, not expert-approved.
The accompanying engine and actual-controller tests cover the fallback's saved
state, source identity, staged display, leakage and no-request behavior. jsdom is
not actual browser verification, expert content review or evidence of learning.

Any future provider needs a separately reviewed corpus and evaluation set,
recorded learner demand, explicit budget and privacy decisions, and controlled
pilot evidence. A code change and owner approval are required to add it. Passing
the authored-help regression tests cannot enable generation or satisfy those gates.
