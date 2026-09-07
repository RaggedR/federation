# Betti numbers over F2 of the nerve of a cover, from its simplices.
# b_k = dim ker(d_k) - rank(d_{k+1}),  d_k : C_k -> C_{k-1}
from itertools import combinations

def rank2(rows, ncols):
    rows = [set(r) for r in rows]; piv, r = {}, 0
    for row in rows:
        row = set(row)
        while row:
            c = min(row)
            if c in piv: row ^= piv[c]
            else: piv[c] = row; r += 1; break
    return r

def boundary(simps_k, simps_km1):
    idx = {s: i for i, s in enumerate(simps_km1)}
    return [[idx[tuple(s[:i] + s[i+1:])] for i in range(len(s))] for s in simps_k], len(simps_km1)

def betti(V, E, F):
    S = {0: [(v,) for v in sorted(V)], 1: sorted(E), 2: sorted(F)}
    d1, n0 = boundary(S[1], S[0]) if S[1] else ([], len(S[0]))
    d2, n1 = boundary(S[2], S[1]) if S[2] else ([], len(S[1]))
    r1, r2 = rank2(d1, n0), rank2(d2, n1)
    b0 = len(S[0]) - r1
    b1 = (len(S[1]) - r1) - r2
    b2 = len(S[2]) - r2
    chi = len(S[0]) - len(S[1]) + len(S[2])
    return b0, b1, b2, chi, len(S[0]), len(S[1]), len(S[2])

def show(name, V, E, F):
    b0, b1, b2, chi, nv, ne, nf = betti(V, E, F)
    print(f"  {name:34} V={nv:3} E={ne:3} F={nf:3}  chi={chi:3}   "
          f"H0={b0} H1={b1} H2={b2}   triples: {'yes' if nf else 'NONE'}")

print("=== nerves of covers, cohomology over F2 ===")
show("3 arcs, triple overlap empty",  {0,1,2}, [(0,1),(1,2),(0,2)], [])
show("3 arcs, triple overlap NONempty", {0,1,2}, [(0,1),(1,2),(0,2)], [(0,1,2)])
show("4 arcs, all triples empty", {0,1,2,3}, [(0,1),(1,2),(2,3),(0,3)], [])
show("4 arcs, ONE triple nonempty", {0,1,2,3},
     [(0,1),(1,2),(2,3),(0,3),(0,2)], [(0,1,2)])

# a two-dimensional base: the torus, as a triangulated 4x4 grid quotient
n = 4
vid = {(i, j): i * n + j for i in range(n) for j in range(n)}
V, E, F = set(vid.values()), set(), set()
for i in range(n):
    for j in range(n):
        a = vid[(i, j)]; b = vid[((i+1) % n, j)]
        c = vid[(i, (j+1) % n)]; d = vid[((i+1) % n, (j+1) % n)]
        for t in [(a, b, d), (a, c, d)]:
            F.add(tuple(sorted(t)))
            for e in combinations(sorted(t), 2): E.add(e)
print()
show("the torus (4x4 triangulated)", V, sorted(E), sorted(F))
print("\n  genus-2 surface, CW: 1 vertex, 4 edges, 1 face on [a,b][c,d]")
print("  the attaching word abelianises to zero, so both boundary maps vanish:")
print("  H0=1 H1=4 H2=1   chi = 1-4+1 = -2 = 2-2g for g=2")
