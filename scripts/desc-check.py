#!/usr/bin/env python3
"""Quick check of meta-description lengths (after placeholders resolve) without a full build."""
import json, re, glob
ph = json.load(open('docs/placeholders.json'))
money = lambda k: float(ph[k].lstrip('$'))
def price(m):
    mi, flags = float(m.group(1)), m.group(2) or ''
    p = money('BASE_FARE') + money('PER_MILE') * mi + (money('HEAVY_FEE') if ':heavy' in flags else 0) + (money('HELPER_FEE') if ':helper' in flags else 0)
    return f'${p:.2f}'
bad = 0
for f in sorted(glob.glob('src/content/pages/**/*.mdx', recursive=True)):
    m = re.search(r'^description:\s*"(.*)"\s*$', open(f).read(), re.M)
    if not m: print('NO DESCRIPTION', f); bad += 1; continue
    d = re.sub(r'\{\{price:(\d+(?:\.\d+)?)((?::(?:heavy|helper))*)\}\}', price, m.group(1))
    d = re.sub(r'\{\{\s*([\w.-]+)\s*\}\}', lambda x: str(ph.get(x.group(1), x.group(0))), d)
    n = len(d)
    flag = '' if 140 <= n <= 155 else ('  (ok, outside 140–155 target)' if 120 <= n <= 160 else '  FAIL')
    if 'FAIL' in flag: bad += 1
    if flag: print(f'{n:4} {f[18:]}{flag}')
print('desc-check:', 'FAIL' if bad else 'ok')
