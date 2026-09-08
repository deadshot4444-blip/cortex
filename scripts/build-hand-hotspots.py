#!/usr/bin/env python3
"""Trace visible hand outlines. Build dependency: shapely==2.0.7 (no browser dependency)."""
from pathlib import Path
import argparse
import json
import re
import xml.etree.ElementTree as ET
from shapely.geometry import Polygon

ROOT = Path(__file__).resolve().parent.parent
GROUPS = {
    'metacarpals': ['path175', 'path191', 'path209', 'path289', 'path327'],
    'hand-proximal-phalanges': ['path19', 'path59', 'path221', 'path261', 'path307'],
    'hand-middle-phalanges': ['path27', 'path231', 'path317', 'path79'],
    'hand-distal-phalanges': ['path45', 'path99', 'path239', 'path245', 'path273'],
    'trapezium': ['path255'], 'trapezoid': ['path301'], 'capitate': ['path121'],
    'hamate': ['path147'], 'scaphoid': ['path111'], 'lunate': ['path131'],
    # The palmar pisiform must receive clicks ahead of the triquetrum behind it.
    'triquetrum': ['path159'], 'pisiform': ['path167'],
}
NUMBER = r'[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?'


def distance(point, a, b):
    delta = b - a
    if not abs(delta):
        return abs(point - a)
    t = max(0, min(1, ((point - a).conjugate() * delta).real / abs(delta) ** 2))
    return abs(point - (a + t * delta))


def curve(a, b, c, d):
    # Subpixel chord error at the figure's maximum rendered height (600px).
    if max(distance(b, a, d), distance(c, a, d)) <= 0.15:
        return [d]
    ab, bc, cd = (a + b) / 2, (b + c) / 2, (c + d) / 2
    abc, bcd = (ab + bc) / 2, (bc + cd) / 2
    middle = (abc + bcd) / 2
    return curve(a, ab, abc, middle) + curve(middle, bcd, cd, d)


def outline(node, parents, viewbox):
    commands = re.findall(r'[A-Za-z]', re.sub(NUMBER, '', node.attrib['d']))
    assert commands[0] == 'm' and commands.count('m') == 1
    assert set(commands) <= {'m', 'c', 'z'}, commands
    tokens = re.findall(r'[mcz]|' + NUMBER, node.attrib['d'])
    cursor, points, i, command = 0j, [], 0, None
    while i < len(tokens):
        if tokens[i] in {'m', 'c', 'z'}:
            command = tokens[i]
            i += 1
            if command == 'z':
                break
        count = 2 if command == 'm' else 6
        values = list(map(float, tokens[i:i + count]))
        i += count
        if command == 'm':
            cursor += complex(*values)
            points.append(cursor)
        else:
            end = cursor + complex(*values[4:])
            points.extend(curve(cursor, cursor + complex(*values[:2]),
                                cursor + complex(*values[2:4]), end))
            cursor = end
    while node is not None:
        transform = node.get('transform')
        if transform:
            assert transform.startswith('matrix('), transform
            a, b, c, d, e, f = map(float, re.findall(NUMBER, transform))
            points = [complex(a * p.real + c * p.imag + e,
                              b * p.real + d * p.imag + f) for p in points]
        node = parents.get(node)
    x, y, width, height = viewbox
    return [[round((p.real - x) / width * 100, 3),
             round((p.imag - y) / height * 100, 3)] for p in points]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    root = ET.parse(ROOT / 'assets/hand.svg').getroot()
    parents = {child: parent for parent in root.iter() for child in parent}
    nodes = {node.get('id'): node for node in root.iter()}
    viewbox = list(map(float, root.attrib['viewBox'].split()))
    lines = ['const HAND_HOTSPOTS = [',
             '  // Generated from assets/hand.svg by scripts/build-hand-hotspots.py.']
    for bone, paths in GROUPS.items():
        for path in paths:
            node = nodes[path]
            assert 'stroke:#000000' in node.get('style', '')
            points = outline(node, parents, viewbox)
            if bone == 'triquetrum':
                # Omit the part hidden by the palmar pisiform in the source image.
                # Normalize the source outline's tiny self-intersection before clipping.
                visible = Polygon(points).buffer(0).difference(Polygon(outline(nodes['path167'], parents, viewbox)))
                assert visible.geom_type == 'Polygon' and not visible.interiors
                points = [[round(x, 3), round(y, 3)] for x, y in visible.exterior.coords[:-1]]
            points = json.dumps(points, separators=(',', ':'))
            lines.append(f"  {{ id: '{bone}', points: {points} }},")
    lines.append('];')
    file = ROOT / 'anatomy.js'
    old = file.read_text()
    new, count = re.subn(r'const HAND_HOTSPOTS = \[.*?\n\];', '\n'.join(lines), old, flags=re.S)
    assert count == 1
    if args.check:
        if old != new:
            raise SystemExit('Hand hotspots are stale. Run python3 scripts/build-hand-hotspots.py.')
        print('Hand hotspots match all 27 source outlines.')
    else:
        file.write_text(new)
        print('Updated 27 hand outlines.')


if __name__ == '__main__':
    main()
