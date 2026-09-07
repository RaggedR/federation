# Check the proposed four-arc cover of the circle really has the intended nerve.
from itertools import combinations
def mem(x, a, b):                       # is x in the ccw arc (a,b), degrees mod 360
    x, a, b = x % 360, a % 360, b % 360
    return a < x < b if a < b else (x > a or x < b)
A = (70, 220); B = (75, 105); C = (320, 110); D = (200, 340)
arcs = {"A": A, "B": B, "C": C, "D": D}
pts = [i * 0.25 for i in range(1440)]   # sample the circle finely
cov = {k: {x for x in pts if mem(x, *v)} for k, v in arcs.items()}

def comps(S):                           # count connected components of a sampled subset
    xs = sorted(S)
    if not xs: return 0
    n = 1
    for u, v in zip(xs, xs[1:]):
        if v - u > 0.3: n += 1
    if len(xs) > 1 and (xs[0] + 360 - xs[-1]) <= 0.3 and n > 1: n -= 1   # wrap
    return n

print("covers the circle:", len(set().union(*cov.values())) == len(pts))
print("\npairs:")
E = []
for a, b in combinations("ABCD", 2):
    I = cov[a] & cov[b]
    if I: E.append(a + b)
    print(f"  {a}{b}: {'nonempty' if I else 'EMPTY   '}  components {comps(I)}")
print("\ntriples:")
F = []
for t in combinations("ABCD", 3):
    I = cov[t[0]] & cov[t[1]] & cov[t[2]]
    if I: F.append("".join(t))
    print(f"  {''.join(t)}: {'nonempty' if I else 'EMPTY   '}  components {comps(I)}")
q = cov["A"] & cov["B"] & cov["C"] & cov["D"]
print(f"\n  ABCD: {'nonempty' if q else 'EMPTY'}")
print(f"\nnerve: V=4  E={len(E)} {E}  F={len(F)} {F}   chi = {4-len(E)+len(F)}")
