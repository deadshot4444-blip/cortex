"""Reproduce original synthetic project inputs, reference results and learning contracts."""
import copy
import hashlib
import inspect
import json
import math
import struct
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]


def _number(value):
    return type(value) in (int, float) and math.isfinite(value)


def _values(samples, allow_empty=False):
    if not isinstance(samples, list) or (not allow_empty and not samples) or not all(_number(x) for x in samples):
        raise ValueError('Expected a list of finite numbers')


def analyze_signal(samples, threshold, sample_rate_hz):
    _values(samples)
    if not _number(threshold) or not _number(sample_rate_hz) or sample_rate_hz <= 0:
        raise ValueError('Use a finite threshold and positive sample rate')
    indices = [i for i, x in enumerate(samples) if x >= threshold]
    return dict(mean=sum(samples) / len(samples), minimum=min(samples), maximum=max(samples),
                duration_s=len(samples) / sample_rate_hz, above_indices=indices, sample_count=len(indices))


def detect_runs(samples, multiplier, sample_rate_hz):
    _values(samples)
    if not _number(multiplier) or multiplier <= 0 or not _number(sample_rate_hz) or sample_rate_hz <= 0:
        raise ValueError('Multiplier and sample rate must be positive')
    mean = sum(samples) / len(samples)
    std = (sum((x - mean) ** 2 for x in samples) / len(samples)) ** 0.5
    threshold = mean - multiplier * std
    events = []
    i = 0
    while i < len(samples):
        if samples[i] >= threshold:
            i += 1
            continue
        start = i
        while i < len(samples) and samples[i] < threshold:
            i += 1
        trough = min(range(start, i), key=lambda j: samples[j])
        events.append(dict(index=trough, amplitude=samples[trough], width_samples=i - start,
                           width_ms=1000 * (i - start) / sample_rate_hz))
    return dict(threshold=threshold, events=events)


def remove_baseline(samples, window):
    _values(samples)
    if type(window) is not int or window < 1:
        raise ValueError('Window must be a positive integer')
    baseline = []
    for i in range(len(samples)):
        available = samples[max(0, i - window + 1):i + 1]
        baseline.append(sum(available) / len(available))
    return dict(baseline=baseline, residual=[x - b for x, b in zip(samples, baseline)])


def fit_decoder(train_x, train_y, test_x):
    if not isinstance(train_x, list) or not train_x or not isinstance(test_x, list):
        raise ValueError('Training and test inputs must be lists')
    _values(train_x[0])
    dimensions = len(train_x[0])
    for row in train_x + test_x:
        _values(row)
        if len(row) != dimensions:
            raise ValueError('Feature dimensions must agree')
    if not isinstance(train_y, list) or len(train_y) != len(train_x) or any(type(y) is not int or y not in (-1, 1) for y in train_y) or set(train_y) != {-1, 1}:
        raise ValueError('Training labels must include both -1 and +1')
    means = {}
    for label in (-1, 1):
        rows = [row for row, y in zip(train_x, train_y) if y == label]
        means[label] = [sum(row[j] for row in rows) / len(rows) for j in range(dimensions)]
    weights = [p - n for p, n in zip(means[1], means[-1])]
    bias = -0.5 * (sum(x * x for x in means[1]) - sum(x * x for x in means[-1]))
    def predict(rows):
        return [1 if sum(w * x for w, x in zip(weights, row)) + bias >= 0 else -1 for row in rows]
    return dict(weights=weights, bias=bias, train_predictions=predict(train_x), test_predictions=predict(test_x))


def control_cursor(targets, gain, delay_steps, max_speed, dt):
    _values(targets, allow_empty=True)
    if not _number(gain) or gain < 0 or type(delay_steps) is not int or delay_steps < 0 or not _number(max_speed) or max_speed <= 0 or not _number(dt) or dt <= 0:
        raise ValueError('Invalid controller parameters')
    positions = [0.0]
    commands = []
    for t, target in enumerate(targets):
        observed = positions[max(0, t - delay_steps)]
        command = max(-max_speed, min(max_speed, gain * (target - observed)))
        commands.append(command)
        positions.append(positions[-1] + command * dt)
    return dict(positions=positions, commands=commands)


def run_pipeline(data):
    required = {'train_trials', 'train_labels', 'test_trials', 'window', 'multiplier', 'sample_rate_hz', 'hold_steps', 'gain', 'delay_steps', 'max_speed', 'dt'}
    if not isinstance(data, dict) or not required.issubset(data) or type(data.get('hold_steps')) is not int or data['hold_steps'] < 1:
        raise ValueError('A positive integer hold_steps is required')
    def features(trials):
        if not isinstance(trials, list):
            raise ValueError('Trials must be a list')
        result = []
        for trial in trials:
            if not isinstance(trial, list) or len(trial) != 2:
                raise ValueError('Each trial must contain exactly two channels')
            row = []
            for channel in trial:
                residual = remove_baseline(channel, data['window'])['residual']
                row.append(len(detect_runs(residual, data['multiplier'], data['sample_rate_hz'])['events']))
            result.append(row)
        return result
    train = features(data['train_trials'])
    test = features(data['test_trials'])
    decoder = fit_decoder(train, data['train_labels'], test)
    targets = [float(label) for label in decoder['test_predictions'] for _ in range(data['hold_steps'])]
    cursor = control_cursor(targets, data['gain'], data['delay_steps'], data['max_speed'], data['dt'])
    return dict(train_features=train, test_features=test, weights=decoder['weights'], bias=decoder['bias'],
                predictions=decoder['test_predictions'], targets=targets, positions=cursor['positions'], commands=cursor['commands'])


FUNCTIONS = [analyze_signal, detect_runs, remove_baseline, fit_decoder, control_cursor, run_pipeline]
HELPERS = 'import math\n\n' + inspect.getsource(_number) + '\n' + inspect.getsource(_values) + '\n'


def reference(function):
    dependencies = FUNCTIONS[1:] if function is run_pipeline else [function]
    return HELPERS + '\n\n'.join(inspect.getsource(fn) for fn in dependencies)


def check(function, label, args, raises=None):
    result = dict(label=label, args=args)
    if raises:
        try:
            function(*copy.deepcopy(args))
        except ValueError:
            result['raises'] = 'ValueError'
        else:
            raise AssertionError('Invalid-input reference did not reject: ' + label)
    else:
        result['expected'] = function(*copy.deepcopy(args))
    return result


def signal(pulse_count, offset=0, drift=0.08, phase=0):
    # 64 samples at 1 kHz. Exact arithmetic formula and pulse additions are the source.
    values = [round(offset + drift * i + 0.35 * math.sin((i + phase) * 0.7), 5) for i in range(64)]
    for at in [10, 28, 46][:pulse_count]:
        for j, value in enumerate([-12, -18, -6]):
            values[at + j] = round(values[at + j] + value, 5)
    return values


def pipeline_input(drift=0.08, delay=8, weak_test=False):
    patterns = [(3, 1), (3, 1), (1, 3), (1, 3)]
    test_patterns = [(3, 1), (1, 3), (2, 2), (1, 3)]
    train = [[signal(a, offset=i, drift=drift, phase=i), signal(b, offset=-i, drift=drift, phase=i + 2)] for i, (a, b) in enumerate(patterns)]
    test = [[signal(a, offset=5 + i, drift=drift * 2, phase=i + 5), signal(b, offset=-3 - i, drift=drift * 2, phase=i + 7)] for i, (a, b) in enumerate(test_patterns)]
    if weak_test:
        test = [[signal(0, drift=0, phase=i), signal(0, drift=0, phase=i + 3)] for i in range(4)]
    return dict(train_trials=train, train_labels=[-1, -1, 1, 1], test_trials=test, window=5,
                multiplier=1.5, sample_rate_hz=1000, hold_steps=20, gain=8, delay_steps=delay, max_speed=4, dt=0.01)


def build():
    m1 = json.loads((ROOT / 'data/labs/m1-recording.json').read_text())
    m2 = json.loads((ROOT / 'data/labs/m2-recording.json').read_text())
    units = json.loads((ROOT / 'data/neuro.json').read_text())['learningPaths'][0]['steps']
    stats_source = dict(title='Python: arithmetic mean and population standard deviation', url='https://docs.python.org/3/library/statistics.html')
    filter_source = dict(title='NumPy: convolution and boundary effects', url='https://numpy.org/doc/stable/reference/generated/numpy.convolve.html')
    decoder_source = dict(title='scikit-learn: nearest-centroid classification', url='https://scikit-learn.org/stable/modules/generated/sklearn.neighbors.NearestCentroid.html')
    split_source = dict(title='scikit-learn: keeping training and test information separate', url='https://scikit-learn.org/stable/common_pitfalls.html#data-leakage')
    projects = []

    def add(key, title, function, unlock, objective, prompt, method, tests, memo, sources, provenance, preview, previous=None):
        signature = str(inspect.signature(function))
        starter = f'def {function.__name__}{signature}:\n    # Implement the documented method. Do not modify the inputs.\n    raise NotImplementedError("Build your analysis here")\n'
        projects.append(dict(id=key, revision=1, title=title, unlockUnit=unlock, prerequisites=[u['id'] for u in units[:unlock]],
            previousProject=previous, objective=objective, prompt=prompt, method=method,
            inputContract='Use plain Python lists and dictionaries. Finite numeric values only; booleans are not numbers. Do not modify input arguments. Invalid cases listed below must raise ValueError. Floating results are compared with relative tolerance 1e-7 and absolute tolerance 1e-9.',
            rubric=['The function returns the documented structure and passes every listed input case.', 'The recorded prediction precedes the first check; the saved run identifies its exact code and input revision.', 'The memo describes the observed result, one limitation and a specific next test. Written quality requires human review.'],
            starter=starter, solution=reference(function), checks=dict(function=function.__name__, preserveArgs=True, captureExampleResult=True, captureResultIndices=[0, 1, 2] if function in (control_cursor, run_pipeline) else [0], cases=tests),
            modelMemo=memo, sources=sources, provenance=provenance, preview=preview,
            review=dict(status='pending', reviewer=None, reviewedOn=None, authorCheckedOn='2026-09-07')))

    add('neural-signal-viewer', 'Neural Signal Viewer', analyze_signal, 7,
        'Describe a sampled signal with units and separate threshold samples from inferred biological events.',
        'Implement analyze_signal(samples, threshold, sample_rate_hz). Return mean, minimum, maximum, duration_s, above_indices and sample_count. An index is included when its sample is greater than or equal to the threshold. Duration is N/sample_rate_hz; the last sample time is (N-1)/sample_rate_hz. These are different quantities.',
        ['Preserve the original sample order and use zero-based indices.', 'Count qualifying samples, including adjacent samples separately. Do not label this count as neurons or action potentials.', 'Reject an empty signal, a nonfinite threshold, or a nonpositive/nonfinite sample rate.'],
        [check(analyze_signal, 'Original 24-sample sequence', [m1['samples'], -50, 1000]),
         check(analyze_signal, 'Equality belongs to the threshold set', [[-51, -50, -49, -50], -50, 1000]),
         check(analyze_signal, 'No threshold samples', [[-4, -3, -2], 0, 10]),
         check(analyze_signal, 'Different rate and positive samples', [[1, 3, 5], 3, 20]),
         check(analyze_signal, 'Empty input is unresolved, not a zero signal', [[], 0, 10], True),
         check(analyze_signal, 'A zero sampling rate is invalid', [[1], 0, 0], True)],
        dict(result='The original sequence has eight qualifying samples. Adjacent indices are still separate samples, so eight is not a validated event or neuron count.',
             limitation='This toy membrane-like voltage sequence is not a cortical LFP recording or a physiologically resolved action-potential dataset. Its original values are retained to make the revised task comparable.',
             next='Vary the threshold and sampling rate separately, then compare sample counts with grouped excursions while explaining the change in definition.'),
        [stats_source], 'Original repository m1-recording.json samples retained exactly. Synthetic teaching sequence; the old LFP/spike labels are not adopted. The prior milestone pass remains a legacy output comparison.',
        dict(kind='signal', samples=m1['samples'], sampleRateHz=1000, units='mV', note='Toy membrane-like samples; no biological event labels.'))

    add('spike-detector', 'Spike Detector + Feature Vector', detect_runs, 12,
        'Group threshold excursions and explain what a global statistical threshold can and cannot establish.',
        'Implement detect_runs(samples, multiplier, sample_rate_hz). Set threshold to mean minus multiplier times population standard deviation. Group consecutive samples strictly below that threshold into one candidate event. Return threshold and events, with each event containing index, amplitude, width_samples and width_ms. The index is the first minimum in the run; width_ms is 1000*width_samples/sample_rate_hz.',
        ['Use one global threshold for this recording. It is not an online adaptive threshold or a drift correction.', 'Close a final run at the end of the recording and break ties at the earliest trough.', 'Reject an empty signal or a nonpositive/nonfinite multiplier or sample rate. A constant signal has no strictly-below-threshold events.'],
        [check(detect_runs, 'Original 240-sample sequence', [m2['samples'], 3.5, 2000]),
         check(detect_runs, 'Adjacent troughs and a final event', [[0, 0, -8, -8, 0, 0, -9], 0.5, 1000]),
         check(detect_runs, 'Constant signal has no events', [[2, 2, 2], 1, 500]),
         check(detect_runs, 'Offset changes threshold but not event indices', [[10, 10, 2, 2, 10, 10, 1], 0.5, 1000]),
         check(detect_runs, 'Empty signal is invalid', [[], 1, 1000], True),
         check(detect_runs, 'Multiplier must be positive', [[0, -1], 0, 1000], True)],
        dict(result='The original global threshold produces four candidate runs. A run can contain several samples, and its width is defined by the threshold crossing.',
             limitation='Candidate runs are not sorted neurons. The global mean and standard deviation include the deflections and drift; a single threshold can miss small events or react to artifacts.',
             next='Compare event indices under a controlled amplitude change and baseline drift. Distinguish false detections from changes caused only by the chosen definition.'),
        [stats_source], 'Original repository m2-recording.json samples retained exactly. Synthetic extracellular-like sequence, with no supported neuron identities. Original output-only completion remains legacy evidence.',
        dict(kind='signal', samples=m2['samples'], sampleRateHz=2000, units='µV', note='Synthetic samples. Candidate event markers appear only after your analysis.'), 'neural-signal-viewer')

    ramp = signal(2, offset=4, drift=0.16)
    add('noise-smoother', 'Noise Smoother & Drift Corrector', remove_baseline, 14,
        'Implement a causal rolling baseline estimate and quantify its edge and waveform distortion.',
        'Implement remove_baseline(samples, window). For sample i, average the samples from max(0,i-window+1) through i, inclusive. Return baseline and residual arrays of the original length, where residual[i] = samples[i] - baseline[i]. Use only the available prefix near the start; do not pad with zeros or use future samples.',
        ['A positive integer window is required; window=1 gives residual zero.', 'This causal estimate includes the current sample. It can attenuate a real deflection and lag a rising baseline.', 'This is baseline subtraction, not proof that noise was removed or the underlying neural signal recovered. Reject empty input or a nonpositive/noninteger window.'],
        [check(remove_baseline, 'Drift plus two synthetic pulse groups', [ramp, 5]),
         check(remove_baseline, 'Prefix boundary uses available samples', [[2, 4, 6], 2]),
         check(remove_baseline, 'Window longer than recording', [[2, 4, 6], 10]),
         check(remove_baseline, 'Unit window removes everything', [[2, -4, 6], 1]),
         check(remove_baseline, 'Future sample must not change earlier output', [[2, 4, 600], 2]),
         check(remove_baseline, 'Zero window is invalid', [[2, 4], 0], True),
         check(remove_baseline, 'Boolean is not a window', [[2, 4], True], True)],
        dict(result='The residual removes a local average. The initial baseline uses fewer samples, and a unit window produces zero everywhere rather than an ideal clean signal.',
             limitation='The moving baseline absorbs some pulse amplitude and creates a post-pulse response. Drift can remain because the estimate lags; zero residual is not evidence of excellent denoising.',
             next='Compare windows 1, 5 and 15 on the same frozen waveform. Report pulse-amplitude change and residual baseline behavior instead of selecting a window from a prettier plot.'),
        [filter_source], 'Original deterministic 64-sample waveform generated by signal() in scripts/build-neuro-projects.py. No people, devices or external recordings are involved. Boundary convention is authored explicitly; it is not numpy.convolve(mode="same").',
        dict(kind='signal', samples=ramp, sampleRateHz=1000, units='µV', note='Synthetic ramp, bounded sinusoidal variation and inserted pulses.'), 'spike-detector')

    train = [[4, 1], [3, 1], [5, 2], [1, 4], [1, 3], [2, 5]]
    labels = [-1, -1, -1, 1, 1, 1]
    heldout = [[4, 2], [2, 4], [3, 3], [5, 1]]
    add('leftright-decoder', 'Weighted Linear Decoder', fit_decoder, 16,
        'Fit an inspectable two-class linear rule using training data only and keep the held-out result separate.',
        'Implement fit_decoder(train_x, train_y, test_x). Compute each class centroid from its training rows. Set weights = centroid(+1) - centroid(-1) and bias = -0.5*(sum(centroid(+1)^2)-sum(centroid(-1)^2)). Predict +1 when dot(weights,x)+bias >= 0, else -1. Return weights, bias, train_predictions and test_predictions. This is the equal-prior Euclidean nearest-centroid boundary with an explicit +1 tie rule.',
        ['Rows must have equal nonzero dimensions and finite values. Both integer labels -1 and +1 must occur in training; their count must match train_x.', 'test_x may be empty. Test labels are never an input to this function.', 'Report small synthetic train and held-out proportions separately. The exercise does not demonstrate generalization to biological recordings, calibrate confidence, or estimate a deployed BCI accuracy.'],
        [check(fit_decoder, 'Separate synthetic training and held-out rows', [train, labels, heldout]),
         check(fit_decoder, 'Translation requires the bias term', [[[11], [13]], [-1, 1], [[10], [12], [14]]]),
         check(fit_decoder, 'Unequal class counts use separate centroids', [[[0, 0], [2, 0], [10, 0]], [-1, -1, 1], [[5, 0], [6, 0]]]),
         check(fit_decoder, 'Three features and reversed labels', [[[0, 0, 0], [2, 2, 2]], [1, -1], [[1, 1, 1], [2, 2, 2]]]),
         check(fit_decoder, 'Empty held-out set is permitted', [[[0], [2]], [-1, 1], []]),
         check(fit_decoder, 'One training class is insufficient', [[[0], [2]], [1, 1], [[1]]], True),
         check(fit_decoder, 'Mismatched feature dimensions are invalid', [[[0], [2]], [-1, 1], [[1, 2]]], True)],
        dict(result='The initial split uses six training rows and four held-out rows. The coefficients are inspectable and are derived only from the training centroids.',
             limitation='Repeatedly choosing parameters after seeing the four held-out labels would turn them into development data. Their observed proportion is not an unbiased final deployment estimate, and a centroid model can underfit or fail under distribution change.',
             next='Write down a new frozen session split and evaluation rule before inspecting its labels. Compare errors and class balance, not only a single accuracy number.'),
        [decoder_source, split_source], 'Original synthetic feature rows with designated labels; no human or animal data. Training rows are fixed independently of the four displayed evaluation labels.',
        dict(kind='decoder', train=train, trainLabels=labels, test=heldout, testLabels=[-1, 1, -1, -1], units='synthetic feature counts'), 'noise-smoother')

    targets = [0.0] * 5 + [1.0] * 55 + [-0.5] * 50
    add('cursor-simulator', 'Cursor Simulator + Latency', control_cursor, 18,
        'Reproduce a delayed-feedback trajectory and distinguish model time from execution time.',
        'Implement control_cursor(targets, gain, delay_steps, max_speed, dt). Start positions=[0.0]. At step t, observe positions[max(0,t-delay_steps)], compute gain*(targets[t]-observed), clip that velocity to [-max_speed,max_speed], and append positions[-1]+velocity*dt. Return positions (N+1 entries) and commands (N entries). Recompute the command from the delayed observation at each step.',
        ['gain is finite and nonnegative. max_speed and dt are finite and positive. delay_steps is a nonnegative integer, not a boolean.', 'At dt=0.01 s, delays 0, 8 and 15 steps represent 0, 80 and 150 ms of modeled observation delay.', 'Targets and positions are arbitrary cursor units, velocity is units/s and gain is 1/s. No inertia, physiological adaptation, transport jitter or real network latency is modeled. An empty target list returns the initial position and no commands.'],
        [check(control_cursor, '80 ms modeled observation delay', [targets, 8, 8, 4, 0.01]),
         check(control_cursor, 'No modeled delay', [targets, 8, 0, 4, 0.01]),
         check(control_cursor, '150 ms modeled observation delay', [targets, 8, 15, 4, 0.01]),
         check(control_cursor, 'Velocity saturation and sign changes', [[2, -2, 2], 10, 0, 1, 0.1]),
         check(control_cursor, 'Zero gain holds the initial position', [[1, 1], 0, 0, 4, 0.01]),
         check(control_cursor, 'Empty target sequence', [[], 8, 0, 4, 0.01]),
         check(control_cursor, 'Negative delay is invalid', [[1], 8, -1, 4, 0.01], True)],
        dict(result='The three delay scenarios use identical targets, gain, speed limit and time step. Their different trajectories therefore reflect this model’s observation delay.',
             limitation='These are deterministic numerical trajectories, not measurements of a human-controlled BCI. Runtime speed does not measure the modeled latency, and clipping can hide some effects of a high gain.',
             next='Change gain while holding dt and target sequence fixed, then compare tracking error and overshoot. State the missing plant and human-feedback assumptions before generalizing.'),
        [], 'Original discrete proportional-control recurrence fully specified in the prompt. The chosen 0/80/150 ms scenarios are teaching parameters, not empirical safety thresholds.',
        dict(kind='cursor', targets=targets, dt=0.01, units='cursor units'), 'leftright-decoder')

    pipeline = pipeline_input()
    invalid = copy.deepcopy(pipeline); invalid['train_labels'] = [1, 1, 1, 1]
    add('closed-loop-capstone', 'Closed-Loop BCI Capstone', run_pipeline, 20,
        'Reproduce a bounded synthetic pipeline and trace how preprocessing, detection and decoding affect its cursor output.',
        'Implement run_pipeline(data), reusing your earlier functions or equivalent code. Each trial has exactly two channels. Apply remove_baseline(channel, window), then detect_runs(residual, multiplier, sample_rate_hz); the two event counts are its feature vector. Fit the centroid decoder using train_trials and train_labels only. Repeat each test prediction as a cursor target for hold_steps, then apply the documented delayed-feedback controller. Return train_features, test_features, weights, bias, predictions, targets, positions and commands.',
        ['Return intermediate arrays so each stage can be inspected. Do not fit or tune with evaluation labels; they are absent from data.', 'Use the preceding projects’ definitions exactly: causal available-prefix baseline, strict global threshold, first-trough grouping, explicit centroid tie rule and delayed observed position.', 'This is a batch signal pipeline feeding a closed-loop cursor model. It is not a live neural decoder, person-specific BCI, safety certification or clinical device. A neuron identity is never inferred from a candidate event count.', 'hold_steps must be a positive integer. Each trial must contain two valid channels. Other invalid input rules carry over from the component functions.'],
        [check(run_pipeline, 'Frozen training and held-out synthetic sessions', [pipeline]),
         check(run_pipeline, 'Changed baseline drift and no observation delay', [pipeline_input(drift=0.25, delay=0)]),
         check(run_pipeline, 'Signal-poor test session and 150 ms delay', [pipeline_input(delay=15, weak_test=True)]),
         check(run_pipeline, 'Invalid one-class training cannot silently produce a decoder', [invalid], True)],
        dict(result='The saved output exposes the feature counts, coefficients, predictions and complete cursor trajectory. A prediction error becomes the wrong cursor target even when the controller implements its recurrence correctly.',
             limitation='A tiny synthetic split and an authored pulse generator cannot establish robustness to real recordings. Whole-trial threshold statistics use the complete trial, so the signal pipeline is batch processing; the cursor feedback loop does not make neural decoding online.',
             next='Specify a new session generator, frozen evaluation protocol and failure criterion before testing. Separate channel dropout, changing pulse amplitude, drift and observation delay so an error can be traced to its cause.'),
        [stats_source, filter_source, decoder_source, split_source], 'Original deterministic two-channel trials generated by signal() and pipeline_input() in this builder. Four training trials and four held-out trials; labels are design annotations, not biological intentions.',
        dict(kind='pipeline', example=pipeline, testLabels=[-1, 1, -1, 1], units='µV samples → candidate counts → arbitrary cursor units'), 'cursor-simulator')

    for project in projects:
        if project['id'] == 'spike-detector':
            project['revision'] = 2
        value = canonical_inputs(project['checks']['cases'][0]['args'])
        project['inputSha256'] = hashlib.sha256(value.encode()).hexdigest()
    return dict(version=1, status='Local author revision; independent engineering review pending', projects=projects)


def canonical_inputs(value):
    """Stable across numeric spelling and JSON's normalization of signed zero."""
    if value is None:
        return 'null'
    if type(value) is bool:
        return 'true' if value else 'false'
    if type(value) in (int, float):
        return 'n' + struct.pack('>d', 0.0 if value == 0 else float(value)).hex()
    if isinstance(value, list):
        return '[' + ','.join(canonical_inputs(v) for v in value) + ']'
    if isinstance(value, dict):
        return '{' + ','.join(json.dumps(k, ensure_ascii=False) + ':' + canonical_inputs(value[k]) for k in sorted(value)) + '}'
    return json.dumps(value, ensure_ascii=False)


def equivalent(a, b):
    """Exact structure and values, allowing last-digit float differences from Python's summation implementation."""
    if type(a) is not type(b):
        return False
    if isinstance(a, float):
        return math.isclose(a, b, rel_tol=1e-9, abs_tol=1e-12)
    if isinstance(a, list):
        return len(a) == len(b) and all(equivalent(x, y) for x, y in zip(a, b))
    if isinstance(a, dict):
        return a.keys() == b.keys() and all(equivalent(a[k], b[k]) for k in a)
    return a == b


if __name__ == '__main__':
    result = json.dumps(build(), ensure_ascii=False, indent=2) + '\n'
    target = ROOT / 'data/neuro-projects.json'
    if '--check' in sys.argv:
        current = target.read_text() if target.exists() else ''
        if current != result and not equivalent(json.loads(current or 'null'), json.loads(result)):
            sys.exit('Project collection is stale; run python3 scripts/build-neuro-projects.py')
    else:
        target.write_text(result)
    data = json.loads(result)
    print('Neuro projects:', len(data['projects']), 'projects,', sum(len(p['checks']['cases']) for p in data['projects']), 'behavior cases; engineering review pending.')
