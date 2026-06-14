#!/usr/bin/env python3
"""Build data/index.json (lightweight search index) from data/<specialty>.json,
and fix 0-based '(option N)' references in explanations -> letter form.

Safe to re-run: reads/writes only the canonical data/*.json files.
"""
import json
import os
import re

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(BASE, "data")

SPECIALTIES = [
    ("emergency-medicine", "Emergency Medicine"),
    ("internal-medicine", "Internal Medicine"),
    ("neurology", "Neurology"),
    ("cardiology", "Cardiology"),
    ("pulmonology", "Pulmonology"),
    ("gastroenterology", "Gastroenterology"),
    ("psychiatry", "Psychiatry"),
    ("obgyn", "OB/GYN"),
    ("pediatrics", "Pediatrics"),
    ("infectious-disease", "Infectious Disease"),
    ("family-medicine", "Family Medicine"),
    ("neurosurgery", "Neurosurgery"),
    ("nephrology", "Nephrology"),
    ("endocrinology", "Endocrinology"),
    ("hematology-oncology", "Hematology & Oncology"),
    ("rheumatology", "Rheumatology"),
    ("general-surgery", "General Surgery"),
    ("orthopedics", "Orthopedics"),
    ("urology", "Urology"),
    ("dermatology", "Dermatology"),
    ("ophthalmology", "Ophthalmology"),
    ("otolaryngology", "Otolaryngology (ENT)"),
    ("pmr", "Physical Medicine & Rehab"),
    ("vascular-neurology", "Vascular Neurology"),
    ("neuro-oncology", "Neuro-Oncology"),
    ("pediatric-neurology", "Pediatric Neurology"),
]

OPT_RE = re.compile(r"\boption(s?)\s+([0-9])\b")


def fix_options(text):
    """option 0 -> option A, options 2 -> options C (0-based digit to letter)."""
    n = [0]

    def repl(m):
        d = int(m.group(2))
        if d > 7:
            return m.group(0)
        n[0] += 1
        return f"option{m.group(1)} {chr(65 + d)}"

    return OPT_RE.sub(repl, text), n[0]


def main():
    index = []
    fixes = 0
    for key, name in SPECIALTIES:
        path = os.path.join(DATA, f"{key}.json")
        if not os.path.exists(path):
            print("skip (missing):", key)
            continue
        doc = json.load(open(path))
        changed = False
        for c in doc["cases"]:
            for s in c["stages"]:
                if s.get("type") == "question" and s.get("explanation"):
                    new, n = fix_options(s["explanation"])
                    if n:
                        s["explanation"] = new
                        fixes += n
                        changed = True
            index.append({
                "id": c["id"],
                "key": key,
                "name": name,
                "title": c["title"],
                "difficulty": c["difficulty"],
                "diagnosis": c["diagnosis"],
            })
        if changed:
            json.dump(doc, open(path, "w"), ensure_ascii=False, indent=1)

    json.dump(index, open(os.path.join(DATA, "index.json"), "w"), ensure_ascii=False)
    print(f"index.json: {len(index)} cases")
    print(f"option-wording fixes applied: {fixes}")


if __name__ == "__main__":
    main()
