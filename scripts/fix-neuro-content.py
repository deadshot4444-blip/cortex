#!/usr/bin/env python3
"""Patch known content errors in data/neuro.json."""
import json
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "data" / "neuro.json"
data = json.loads(path.read_text())

lessons = {l["id"]: l for l in data["neuroCodeLessons"]}

# Spike counting: threshold change should alter count
spike = lessons["code-loops-spike-counting"]
spike["codeExample"] = (
    "\nsignal_mv = [-70, -55, -42, -66, -44, -39, -71]\n"
    "threshold_mv = -50\nspike_count = 0\n\n"
    "for sample in signal_mv:\n"
    "    if sample >= threshold_mv:\n"
    "        spike_count = spike_count + 1\n\n"
    "print(\"Spikes:\", spike_count)\n"
)
spike["expectedOutput"] = "Spikes: 3"
spike["solution"] = (
    "\nsignal_mv = [-70, -55, -42, -66, -44, -39, -71]\n"
    "threshold_mv = -45\nspike_count = 0\n\n"
    "for sample in signal_mv:\n"
    "    if sample >= threshold_mv:\n"
    "        spike_count = spike_count + 1\n\n"
    "print(\"Spikes:\", spike_count)\n"
)

# RMS math: sqrt(180/8) = 4.74
feat = lessons["code-feature-extraction"]
feat["expectedOutput"] = "\nspike_count: 2\nrms: 4.74\n"

# Linear decoder: 4 + 13.5 - 3 = 14.5
dec = lessons["code-simple-bci-decoder"]
dec["expectedOutput"] = "\nscore: 14.5\ncommand: right\n"

# Neuropixels classification
for topic in data["topics"]:
    if topic["id"] == "im-electrodes":
        topic["explanation"] = topic["explanation"].replace(
            "flexible polymer-based probes (Neuropixels, Neuralink threads)",
            "high-density silicon CMOS probes (Neuropixels), flexible polymer threads (Neuralink-style)",
        )
        break

path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
print("Patched neuro.json")