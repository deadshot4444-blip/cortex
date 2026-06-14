#!/usr/bin/env python3
"""Merge data/raw/<specialty>-b*.json batch files into data/<specialty>.json + manifest.json.

Validates every case, renumbers ids, dedupes obvious repeats, reports shortfalls.
Exit code 0 always (report-driven); read the printed summary.
"""
import json
import glob
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(BASE, "data", "raw")
OUT = os.path.join(BASE, "data")

SPECIALTIES = [
    ("emergency-medicine", "Emergency Medicine", "em"),
    ("internal-medicine", "Internal Medicine", "im"),
    ("neurology", "Neurology", "nr"),
    ("cardiology", "Cardiology", "cd"),
    ("pulmonology", "Pulmonology", "pm"),
    ("gastroenterology", "Gastroenterology", "gi"),
    ("psychiatry", "Psychiatry", "py"),
    ("obgyn", "OB/GYN", "ob"),
    ("pediatrics", "Pediatrics", "pd"),
    ("infectious-disease", "Infectious Disease", "inf"),
    ("family-medicine", "Family Medicine", "fm"),
    ("neurosurgery", "Neurosurgery", "ns"),
    ("nephrology", "Nephrology", "nph"),
    ("endocrinology", "Endocrinology", "endo"),
    ("hematology-oncology", "Hematology & Oncology", "ho"),
    ("rheumatology", "Rheumatology", "rh"),
    ("general-surgery", "General Surgery", "gs"),
    ("orthopedics", "Orthopedics", "orth"),
    ("urology", "Urology", "ur"),
    ("dermatology", "Dermatology", "dm"),
    ("ophthalmology", "Ophthalmology", "oph"),
    ("otolaryngology", "Otolaryngology (ENT)", "ent"),
    ("pmr", "Physical Medicine & Rehab", "pmr"),
    ("vascular-neurology", "Vascular Neurology", "vn"),
    ("neuro-oncology", "Neuro-Oncology", "no"),
    ("pediatric-neurology", "Pediatric Neurology", "pn"),
]

REQUIRED = ["title", "difficulty", "setting", "patient", "chiefComplaint",
            "history", "vitals", "exam", "stages", "diagnosis", "pearls"]


def validate(case):
    errs = []
    for f in REQUIRED:
        if not case.get(f):
            errs.append(f"missing/empty {f}")
    stages = case.get("stages") or []
    questions = [s for s in stages if isinstance(s, dict) and s.get("type") == "question"]
    if not 3 <= len(questions) <= 6:
        errs.append(f"{len(questions)} question stages")
    for i, s in enumerate(stages):
        if not isinstance(s, dict):
            errs.append(f"stage {i}: not an object")
            continue
        if s.get("type") == "question":
            opts = s.get("options") or []
            if not 3 <= len(opts) <= 6:
                errs.append(f"stage {i}: {len(opts)} options")
            a = s.get("answer")
            if not isinstance(a, int) or not 0 <= a < len(opts):
                errs.append(f"stage {i}: bad answer index {a!r}")
            if not s.get("question"):
                errs.append(f"stage {i}: empty question")
            if not s.get("explanation"):
                errs.append(f"stage {i}: empty explanation")
        elif s.get("type") == "result":
            if not s.get("content"):
                errs.append(f"stage {i}: empty result content")
        else:
            errs.append(f"stage {i}: unknown type {s.get('type')!r}")
    vit = case.get("vitals")
    if not isinstance(vit, dict) or len(vit) < 4:
        errs.append("vitals must be a dict with >=4 entries")
    pearls = case.get("pearls")
    if not isinstance(pearls, list) or len(pearls) < 2:
        errs.append("pearls must be a list with >=2 entries")
    return errs


def main():
    manifest = {}
    report = []
    grand = 0
    for key, name, prefix in SPECIALTIES:
        files = sorted(glob.glob(os.path.join(RAW, f"{key}-b*.json")))
        cases, bad, seen_sig = [], [], set()
        for path in files:
            try:
                with open(path) as fh:
                    arr = json.load(fh)
            except Exception as e:
                bad.append(f"{os.path.basename(path)}: JSON parse error: {e}")
                continue
            if isinstance(arr, dict):
                arr = arr.get("cases", [arr])
            if not isinstance(arr, list):
                bad.append(f"{os.path.basename(path)}: not a list")
                continue
            for j, case in enumerate(arr):
                errs = validate(case)
                if errs:
                    bad.append(f"{os.path.basename(path)}[{j}]: " + "; ".join(errs))
                    continue
                sig = (case["title"].strip().lower(), case["diagnosis"].strip().lower())
                if sig in seen_sig:
                    bad.append(f"{os.path.basename(path)}[{j}]: duplicate ({case['title']})")
                    continue
                seen_sig.add(sig)
                case.pop("_comment", None)
                for s in case["stages"]:
                    s.pop("_comment", None)
                cases.append(case)

        cases = cases[:100]
        for i, case in enumerate(cases):
            case["id"] = f"{prefix}-{i + 1:03d}"
        out = {"specialty": key, "name": name, "cases": cases}
        with open(os.path.join(OUT, f"{key}.json"), "w") as fh:
            json.dump(out, fh, ensure_ascii=False, indent=1)
        manifest[key] = len(cases)
        grand += len(cases)
        status = "OK " if len(cases) >= 100 else "LOW"
        report.append(f"{status} {key:<22} {len(cases):>3} cases   ({len(bad)} rejected)")
        for b in bad[:8]:
            report.append(f"      - {b}")
        if len(bad) > 8:
            report.append(f"      - ... and {len(bad) - 8} more rejects")

    with open(os.path.join(OUT, "manifest.json"), "w") as fh:
        json.dump(manifest, fh, indent=1)

    print("\n".join(report))
    print(f"\nTOTAL: {grand} cases -> manifest.json written")


if __name__ == "__main__":
    main()
