# Milestone 2.28: operations and distribution

Decision: prepare measurement and review work; commercial and acquisition
experiments remain deferred. No campaign, outreach, partnership, donation page,
pricing change, analytics collection or recurring paid service was launched.
The promised free MCAT core remains free. Local test accounts and automated
sessions are not returning learners or acquisition results.

## First bounded experiments, after readiness

| Experiment | Concrete offer | Required evidence before launch | Stop condition |
| --- | --- | --- | --- |
| Useful public lesson | One independently reviewed MCAT lesson, with accurate scope and a direct study action | Content approval, accessible first session, a reliable return journey | Content defect, broken saving, or support demand beyond the owner's approved capacity |
| Student organization referral | An optional introduction to that lesson and its free course | Organization consent, owner-approved copy, attribution/privacy decision | Partner withdraws consent or learners reasonably misunderstand coverage or affiliation |
| Educator referral | The same lesson and optional private portfolio workflow | Committed partner and clear separation from a graded institutional assignment | Sharing confusion, access defect or unsupported endorsement claim |

Launch one experiment at a time and decide its observation window and decision
rule before launch. A lesson page view is not activation. A returning browser is
not necessarily a returning learner. With low volume, report counts and limits;
do not manufacture conversion or retention estimates from sample data.

## Measurement contract

The companion operating-record.json is an empty template, not a current financial
or analytics report. Null means unknown. Zero must mean a verified zero over the
named interval. Manual entries require a source and a recorded date. Never put
account tokens, full emails, raw learner writing or health information in it.

- Source cohort: learners attributed through an explicitly chosen, privacy-aware
  referral mechanism. Keep unattributed and ambiguous records visible. Define
  deduplication and bot/test exclusions before counting.
- Activation: a learner completes one substantive learning loop, including their
  own response and its feedback, within seven days of the first attributable
  visit. Record eligible cohort, observation window, denominator and exclusions.
- Return: an activated learner completes another substantive loop on a different
  day within the following seven days. Report only cohorts with a full observation
  window. Do not count reloads, retries or viewing an answer as a second loop.
- Support: actual support contacts and time spent, categorized as saving/access,
  content confusion, product usability or other. One issue can have many contacts.
- Editorial: authoring and independent-review hours and actual cash expenditure,
  separately. Free volunteer time is still recorded as time. No review completion
  is inferred from paying an invoice or running tests.
- Recurring cost: hosting, authentication/database, storage, domain, monitoring,
  and any later inference provider. Record currency, billing interval, actual paid
  amount, accrued cost if available, source and verified date. Keep one-off cost,
  credits and forecast separate from recurring actuals.

Useful ratios can be computed only after these inputs exist. Cost per activated
returning learner uses the agreed attributable spend and a fully observed cohort;
it is undefined when its denominator is zero or unknown. Editorial throughput and
support demand help choose capacity, but do not establish learning effectiveness.

## Commercial boundaries

Any sponsorship, donation or optional institutional service needs a concrete
owner-approved offer, recipient/partner, terms, duration, spending cap and stop
mechanism before launch. Keep sponsorship visibly separate from instructional
judgment. Do not sell an assessment or independently reviewed claim that Cortex
has not earned. Institution-only features must not quietly remove or charge for
the promised free MCAT core. Do not promise tax treatment or institutional
compliance without the relevant review.

Before an experiment: verify the actual recurring costs, choose a support-hours
ceiling, approve a spending cap and assign an accountable owner. Afterwards:
report results against the predeclared rule, include missing data and withdrawals,
and record continue/change/stop with its reason. None of these business gates has
passed from this local implementation run.
