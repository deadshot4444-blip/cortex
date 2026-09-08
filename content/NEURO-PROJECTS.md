# Reproducible Neuroengineering projects

The six existing practitioner milestone IDs now use one saved project player. Their scope is a synthetic teaching progression: sampled-signal descriptions, grouped threshold excursions, causal baseline subtraction, nearest-centroid decoding, delayed cursor feedback, and a batch signal-analysis pipeline feeding that toy cursor. All independent engineering reviews remain pending. The catalog's `live` flag means the local player is available; it is not a publication or review record.

`scripts/build-neuro-projects.py` is the repeatable authoring source for `data/neuro-projects.json`; `--check` detects drift. It retains the original M1 and M2 sample arrays exactly and constructs the remaining deterministic synthetic inputs. No external or patient dataset is used. Update source, revision, reference cases and review status together when changing a project. `scripts/check-neuro-projects.cjs --json` derives a review queue covering every project, input case, prerequisite and rubric, with complete project hashes.

## Methods and limits

1. Signal Viewer counts samples at or above a threshold, not spikes or neurons. Duration is N/fs; the final sample time is (N−1)/fs. The retained 24-sample sequence is a toy membrane-like signal, not an LFP recording.
2. Spike Detector retains its existing ID but groups contiguous samples strictly below one global mean minus a multiple of population standard deviation. The earliest minimum selects a tied trough. Width is the qualifying run length divided by sample rate. These are candidate excursions; the method neither sorts neurons nor adapts its baseline over time.
3. Baseline subtraction uses a causal rolling mean including the current sample and available prefix. It cannot see future samples. It can attenuate events, lag drift and create post-event responses; lower residual amplitude alone does not establish better signal quality.
4. The decoder uses equal-prior Euclidean nearest centroids from training rows only. The difference of centroids gives the weights; half their squared-norm difference gives the bias. A tie selects +1. Test truth is displayed only for comparison, not passed into fitting. Tiny synthetic held-out results do not establish generalization, and repeated test-directed tuning compromises that holdout.
5. The cursor uses x[0]=0, delayed observation x[max(0,t−delay)], command clipped to ±max_speed, and x[t+1]=x[t]+command*dt. Delay is model steps times dt, not measured browser, device or human latency. This is an original explicit recurrence, not a device controller specification.
6. The capstone subtracts the baseline, extracts candidate counts from each complete trial, fits the classifier and turns its predictions into toy cursor targets. Whole-trial statistics make the decoder a batch process. Only the toy cursor has feedback; no real-time neural decoding, clinical safety, device readiness or BCI effectiveness is claimed.

Python's [statistics documentation](https://docs.python.org/3/library/statistics.html) supports the mean and population-SD definitions. [NumPy's convolution documentation](https://numpy.org/doc/stable/reference/generated/numpy.convolve.html) discusses finite-signal boundaries; the exercise's available-prefix rule is explicitly specified rather than delegated to a library default. The classifier is grounded in [nearest-centroid documentation](https://scikit-learn.org/stable/modules/generated/sklearn.neighbors.NearestCentroid.html), with the split limits described by [scikit-learn's leakage guidance](https://scikit-learn.org/stable/common_pitfalls.html#data-leakage). Implementations use Python built-ins, not these packages.

## Saved work and completion

New records live in `cs-neuro.projects[id]`, with a current run and retained completed history. Existing `cs-neuro.milestones` flags remain unchanged and are described as earlier output checks. They retain prior access but are not converted into new project comparisons. Fresh access requires the actual prerequisite unit IDs and the preceding project; unrelated completion counts do not unlock projects.

A run freezes the full project, original input revision, first prediction, each checked code version and its results. An edited draft needs a fresh passing check. Completion also requires a result, limitation and next-test memo; only the presence of writing is checked. No prose quality, independent skill or professional competence is automatically graded. Opening the in-app reference is recorded. Absence of that event is not evidence of unaided work: learners can receive help elsewhere, and the complete saved JSON includes the authored reference.

Start and run state must persist before Python starts. Failed saves pause progression and retain the in-memory draft through shared StudyStorage recovery. Stop, navigation and reload interrupt pending checks without awarding a pass. Completed runs remain fixed when another attempt starts. A saved run opens from its own snapshot without fetching the current catalog.

The input SHA-256 covers the canonical first example arguments. Canonical numbers are `n` followed by big-endian IEEE-754 float64 hex; object keys are sorted, arrays retain order, and strings, booleans and null use JSON syntax. This avoids Python/JavaScript number-format differences. The separate complete-project hash in the reviewer queue covers the content, cases and reference code. Neither hash certifies authorship or approval.

The Python export contains the exact saved code and documented test inputs; it runs independently with standard Python. Full JSON includes the complete selected run and its legacy milestone context. These exports are user-controlled files, not public portfolio pages. The backup parser treats project code as escaped plain text; older HTML lesson snapshots retain their markup restrictions.

## Verification boundaries

The six references pass 37 behavior cases under CPython; six plausible wrong algorithms fail. Independent numerical checks cover sample timing, excursion grouping, baseline boundaries, centroid geometry, delayed feedback and the full pipeline. Ten DOM-controller scenarios cover all six projects, exports, saved resume, interruption, failed saves, ownership conflicts and damaged input digests. Existing NeuroCode, simulation and worker-contract regressions also pass.

These are local code and handler checks. They do not establish actual Pyodide execution, browser layout, downloaded-file interaction, learner usability, independent engineering review or production readiness. The requested real browser walkthrough remains a separate release gate.
