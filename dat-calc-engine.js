/* DAT on-screen calculator (DAT-06). Pure UMD, no DOM: the Windows-standard basic calculator
   as a state machine, so dat-qr.js only draws keys and reads a display string and the Node
   tests can drive every key without a document.

   The exam's calculator is the Windows basic calculator (RESEARCH §2.3): MC MR MS M+ M−,
   backspace, CE, C, ± , √, ÷, %, ×, 1/x, −, +, =, the ten digits and a decimal point. There is
   no exponent, trigonometry, logarithm or bracket key, and it takes MOUSE CLICKS ONLY — which
   is why this file installs nothing and dat-qr.js registers no keydown handler.

   Semantics that differ from a pocket calculator and are therefore pinned by tests:
   - Immediate execution, not precedence: `2 + 3 × 4 =` is 20, never 14.
   - CE clears the entry and leaves the pending operation; C clears everything but the memory.
   - `%` is the Windows percent: with + or − pending it means "that percent OF the accumulator",
     with × or ÷ pending it is simply x/100, and with nothing pending it is 0.
   - √ of a negative and ÷ 0 raise an error state, which the next entry clears.
   - `=` pressed again repeats the last operation against the last right-hand operand. */
(function (root) {
  'use strict';
  // 12 significant digits shown, 16 keyed: the display never advertises float noise
  // (0.1 + 0.2 reads 0.3) and a learner cannot key a number longer than the real keypad takes.
  const PRECISION = 12;
  const MAX_ENTRY = 16;
  const ERRORS = {
    divideByZero: 'Cannot divide by zero',
    invalidInput: 'Invalid input',
    overflow: 'Overflow',
  };
  const OPS = {
    add: (a, b) => a + b,
    sub: (a, b) => a - b,
    mul: (a, b) => a * b,
    div: (a, b) => a / b,
  };
  const OP_SIGNS = { add: '+', sub: '−', mul: '×', div: '÷' };
  // Key rows in the order the Windows basic calculator lays them out. `kind` is for styling
  // only; `aria` is the accessible name where the glyph is not one.
  const KEYS = [
    [
      { key: 'mc', label: 'MC', aria: 'Memory clear', kind: 'mem' },
      { key: 'mr', label: 'MR', aria: 'Memory recall', kind: 'mem' },
      { key: 'ms', label: 'MS', aria: 'Memory store', kind: 'mem' },
      { key: 'm+', label: 'M+', aria: 'Memory add', kind: 'mem' },
      { key: 'm-', label: 'M−', aria: 'Memory subtract', kind: 'mem' },
    ],
    [
      { key: 'back', label: '←', aria: 'Backspace', kind: 'fn' },
      { key: 'ce', label: 'CE', aria: 'Clear entry', kind: 'fn' },
      { key: 'c', label: 'C', aria: 'Clear all', kind: 'fn' },
      { key: 'sign', label: '±', aria: 'Change sign', kind: 'fn' },
      { key: 'sqrt', label: '√', aria: 'Square root', kind: 'fn' },
    ],
    [
      { key: '7', label: '7', kind: 'digit' },
      { key: '8', label: '8', kind: 'digit' },
      { key: '9', label: '9', kind: 'digit' },
      { key: 'div', label: '÷', aria: 'Divide', kind: 'op' },
      { key: 'pct', label: '%', aria: 'Percent', kind: 'fn' },
    ],
    [
      { key: '4', label: '4', kind: 'digit' },
      { key: '5', label: '5', kind: 'digit' },
      { key: '6', label: '6', kind: 'digit' },
      { key: 'mul', label: '×', aria: 'Multiply', kind: 'op' },
      { key: 'recip', label: '1/x', aria: 'Reciprocal', kind: 'fn' },
    ],
    [
      { key: '1', label: '1', kind: 'digit' },
      { key: '2', label: '2', kind: 'digit' },
      { key: '3', label: '3', kind: 'digit' },
      { key: 'sub', label: '−', aria: 'Subtract', kind: 'op' },
      { key: 'eq', label: '=', aria: 'Equals', kind: 'eq' },
    ],
    [
      { key: '0', label: '0', kind: 'digit' },
      { key: '.', label: '.', aria: 'Decimal point', kind: 'digit' },
      { key: 'add', label: '+', aria: 'Add', kind: 'op' },
    ],
  ];
  const DIGIT = /^[0-9]$/;

  /* ---------- display formatting ---------- */
  function trimExponent(text) {
    const parts = text.split('e');
    let mantissa = parts[0];
    if (mantissa.indexOf('.') >= 0) mantissa = mantissa.replace(/0+$/, '').replace(/\.$/, '');
    return mantissa + 'e' + parts[1];
  }
  function format(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) return ERRORS.invalidInput;
    if (!Number.isFinite(value)) return ERRORS.overflow;
    if (value === 0) return '0'; // never shows "-0"
    const magnitude = Math.abs(value);
    if (magnitude >= 1e16 || magnitude < 1e-12) return trimExponent(value.toExponential(PRECISION - 1));
    let text = value.toPrecision(PRECISION);
    if (text.indexOf('e') >= 0) return trimExponent(text);
    if (text.indexOf('.') >= 0) text = text.replace(/0+$/, '').replace(/\.$/, '');
    return text;
  }

  /* ---------- state ---------- */
  // { entry, typing, value, acc, op, lastOp, lastOperand, memory, memoryActive, error }
  // `entry` is the digit string while the learner is keying; `value` is the number otherwise.
  // Every transition returns a NEW object: nothing here mutates the state it was handed.
  function blank(previous) {
    return {
      entry: '0',
      typing: false,
      value: 0,
      acc: 0,
      op: null,
      lastOp: null,
      lastOperand: null,
      memory: previous ? previous.memory : 0,
      memoryActive: previous ? !!previous.memoryActive : false,
      error: null,
    };
  }
  function init() {
    return blank(null);
  }
  function next(state, patch) {
    return Object.assign({}, state, patch);
  }
  function current(state) {
    return state.typing ? Number(state.entry) : state.value;
  }
  function display(state) {
    if (!state) return '0';
    if (state.error) return state.error;
    return state.typing ? state.entry : format(state.value);
  }
  // The pending left operand and operator, for the small line above the display.
  function expression(state) {
    if (!state || state.error || !state.op) return '';
    return format(state.acc) + ' ' + OP_SIGNS[state.op];
  }
  function memoryActive(state) {
    return !!(state && state.memoryActive);
  }

  /* ---------- arithmetic ---------- */
  function apply(op, a, b) {
    if (op === 'div' && b === 0) return { error: ERRORS.divideByZero };
    const value = OPS[op](a, b);
    if (!Number.isFinite(value)) return { error: ERRORS.overflow };
    return { value };
  }
  function fault(state, message) {
    return Object.assign(blank(state), { error: message });
  }

  /* ---------- transitions ---------- */
  function digit(state, key) {
    if (!state.typing) return next(state, { entry: key, typing: true });
    if (state.entry.replace(/[-.]/g, '').length >= MAX_ENTRY) return state;
    if (state.entry === '0') return next(state, { entry: key });
    if (state.entry === '-0') return next(state, { entry: '-' + key });
    return next(state, { entry: state.entry + key });
  }
  function point(state) {
    if (!state.typing) return next(state, { entry: '0.', typing: true });
    if (state.entry.indexOf('.') >= 0) return state;
    return next(state, { entry: state.entry + '.' });
  }
  // Immediate execution: an operator with a pending operator and a fresh entry folds the
  // pending one first, so 2 + 3 × 4 = evaluates (2 + 3) × 4.
  function operator(state, op) {
    const x = current(state);
    const settled = { op, typing: false, entry: '0', lastOp: null, lastOperand: null };
    if (state.op && state.typing) {
      const result = apply(state.op, state.acc, x);
      if (result.error) return fault(state, result.error);
      return next(state, Object.assign({ value: result.value, acc: result.value }, settled));
    }
    // No entry since the last operator: the learner is replacing the operator, not chaining.
    return next(state, Object.assign({ value: x, acc: x }, settled));
  }
  function equals(state) {
    const x = current(state);
    if (state.op) {
      const result = apply(state.op, state.acc, x);
      if (result.error) return fault(state, result.error);
      return next(state, {
        value: result.value,
        acc: result.value,
        op: null,
        typing: false,
        entry: '0',
        lastOp: state.op,
        lastOperand: x,
      });
    }
    // A repeated = re-applies the last operation to the last right-hand operand.
    if (state.lastOp) {
      const result = apply(state.lastOp, x, state.lastOperand);
      if (result.error) return fault(state, result.error);
      return next(state, { value: result.value, acc: result.value, typing: false, entry: '0' });
    }
    return next(state, { value: x, acc: x, typing: false, entry: '0' });
  }
  // Windows percent: a percentage OF the accumulator under + and −, a plain hundredth under
  // × and ÷, and 0 with nothing pending.
  function percent(state) {
    const x = current(state);
    let value;
    if (state.op === 'add' || state.op === 'sub') value = state.acc * (x / 100);
    else if (state.op === 'mul' || state.op === 'div') value = x / 100;
    else value = 0;
    if (!Number.isFinite(value)) return fault(state, ERRORS.overflow);
    return next(state, { value, typing: false, entry: '0' });
  }
  function squareRoot(state) {
    const x = current(state);
    if (x < 0) return fault(state, ERRORS.invalidInput);
    return next(state, { value: Math.sqrt(x), typing: false, entry: '0' });
  }
  function reciprocal(state) {
    const x = current(state);
    if (x === 0) return fault(state, ERRORS.divideByZero);
    return next(state, { value: 1 / x, typing: false, entry: '0' });
  }
  function sign(state) {
    if (state.typing)
      return next(state, { entry: state.entry.charAt(0) === '-' ? state.entry.slice(1) : '-' + state.entry });
    return next(state, { value: state.value === 0 ? 0 : -state.value });
  }
  function backspace(state) {
    if (!state.typing) return state; // Windows: backspace does nothing to a result
    let entry = state.entry.slice(0, -1);
    if (entry === '' || entry === '-') entry = '0';
    return next(state, { entry });
  }
  // CE drops the entry and keeps the pending operation; C drops everything but the memory.
  function clearEntry(state) {
    return next(state, { entry: '0', typing: false, value: 0, error: null });
  }
  function memory(state, key) {
    const x = current(state);
    if (key === 'mc') return next(state, { memory: 0, memoryActive: false });
    if (key === 'mr')
      return state.memoryActive ? next(state, { value: state.memory, typing: false, entry: '0' }) : state;
    const stored = key === 'ms' ? x : key === 'm+' ? state.memory + x : state.memory - x;
    if (!Number.isFinite(stored)) return fault(state, ERRORS.overflow);
    return next(state, { memory: stored, memoryActive: true, value: x, typing: false, entry: '0' });
  }

  /* ---------- the one entry point ---------- */
  function press(state, key) {
    const s = state && typeof state === 'object' ? state : init();
    const k = String(key);
    if (s.error) {
      // The error clears on the next entry, on C/CE, and on a memory clear; every other key
      // is ignored while it stands, so a stray click cannot compute against a failed result.
      if (k === 'c') return blank(s);
      if (k === 'ce') return clearEntry(s);
      if (k === 'mc') return next(s, { memory: 0, memoryActive: false });
      if (DIGIT.test(k) || k === '.') return press(blank(s), k);
      return s;
    }
    if (DIGIT.test(k)) return digit(s, k);
    switch (k) {
      case '.':
        return point(s);
      case 'add':
      case 'sub':
      case 'mul':
      case 'div':
        return operator(s, k);
      case 'eq':
        return equals(s);
      case 'pct':
        return percent(s);
      case 'sqrt':
        return squareRoot(s);
      case 'recip':
        return reciprocal(s);
      case 'sign':
        return sign(s);
      case 'back':
        return backspace(s);
      case 'ce':
        return clearEntry(s);
      case 'c':
        return blank(s);
      case 'mc':
      case 'mr':
      case 'ms':
      case 'm+':
      case 'm-':
        return memory(s, k);
      default:
        return s;
    }
  }
  // Convenience for tests and for replaying a key list: never used by the UI, which presses
  // one key per click.
  function run(keys, state) {
    return (keys || []).reduce(press, state || init());
  }

  const api = { KEYS, ERRORS, PRECISION, MAX_ENTRY, init, press, run, display, expression, memoryActive, format };
  root.DatCalcCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
