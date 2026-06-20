#!/usr/bin/env node
/**
 * Rebalance clinical scenario MCQs: even answer positions + parallel option lengths.
 * Idempotent-ish: safe to re-run; shuffles and trims/expands outliers.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA = path.join(ROOT, 'data');
const manifest = JSON.parse(fs.readFileSync(path.join(DATA, 'manifest.json'), 'utf8'));

function shuffle(a) {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

function compressOption(text) {
  let t = text.trim();
  t = t.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const parts = t.split(/\s*[—;]\s*/);
  if (parts[0].length >= 18) t = parts[0].trim();
  t = t.replace(/\s+as needed$/i, '').replace(/\s+with close follow-up$/i, '').trim();
  t = t.replace(/\s+in this (patient|presentation|clinical context)$/i, '').trim();
  return t;
}

const EXPAND_BY_LABEL = {
  'INITIAL APPROACH': [' as the first step today', ' before invasive testing', ' in the outpatient setting'],
  'DIAGNOSTIC TEST': [' as the initial study', ' before confirmatory imaging', ' in a stable patient'],
  'DIAGNOSIS': [' as the primary diagnosis', ' given the available data', ' in this clinical picture'],
  'MANAGEMENT': [' as initial therapy', ' before specialist referral', ' as monotherapy'],
  'DISPOSITION': [' with appropriate follow-up', ' after initial stabilization', ' based on current risk'],
  'NEXT STEP': [' as the immediate next step', ' before discharge planning', ' in this setting'],
  'COMPLICATION': [' as the leading concern', ' requiring urgent evaluation', ' in this presentation'],
};

function expandOption(text, targetLen, label) {
  let t = text.trim();
  const pool = EXPAND_BY_LABEL[label] || EXPAND_BY_LABEL['NEXT STEP'];
  const stems = [...pool.map(s => s.trim()), 'in this clinical context'];
  const hasStem = stems.some(stem => t.toLowerCase().includes(stem.toLowerCase()));
  if (t.length >= targetLen - 8 || hasStem) return t;
  for (const sfx of pool) {
    const next = t + sfx;
    if (next.length <= targetLen + 6) return next;
  }
  const fallback = ' in this clinical context';
  if ((t + fallback).length <= targetLen + 10) return t + fallback;
  return t;
}

function balanceLengths(opts, correctIdx, label) {
  const labelKey = (label || '').toUpperCase();
  let correct = opts[correctIdx];
  let wrong = opts.filter((_, i) => i !== correctIdx);
  let avgWrong = wrong.reduce((a, o) => a + o.length, 0) / wrong.length;
  const band = Math.max(28, Math.round((correct.length + avgWrong) / 2));

  if (correct.length > avgWrong + 8) correct = compressOption(correct);
  avgWrong = wrong.reduce((a, o) => a + o.length, 0) / wrong.length;
  if (correct.length > avgWrong + 8) {
    const parts = correct.split(/\s+and\s+/i);
    if (parts[0].length >= 20) correct = parts[0].trim();
  }

  const target = Math.max(band, correct.length - 6, avgWrong + 4);
  wrong = wrong.map(o => expandOption(o, target, labelKey));

  let wi = 0;
  return opts.map((_, i) => (i === correctIdx ? correct : wrong[wi++]));
}

function balanceStage(stage) {
  if (stage.type !== 'question' || stage.answer == null || !stage.options?.length) return false;

  const correctIdx = stage.answer;
  const opts = balanceLengths(stage.options.map(o => String(o).trim()), correctIdx, stage.label);

  const pairs = opts.map((text, origIdx) => ({ text, origIdx }));
  const shuffled = shuffle(pairs);
  stage.options = shuffled.map(p => p.text);
  stage.answer = shuffled.findIndex(p => p.origIdx === correctIdx);
  return true;
}

let files = 0;
let questions = 0;

for (const key of Object.keys(manifest)) {
  const file = path.join(DATA, `${key}.json`);
  if (!fs.existsSync(file)) continue;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  let touched = 0;
  for (const c of data.cases || []) {
    for (const s of c.stages || []) {
      if (balanceStage(s)) touched++;
    }
  }
  if (touched) {
    fs.writeFileSync(file, JSON.stringify(data, null, 1) + '\n');
    files++;
    questions += touched;
    console.log(`${key}: ${touched} questions rebalanced`);
  }
}

console.log(`Done — ${questions} questions across ${files} specialty files.`);