#!/usr/bin/env python3
"""The obstruction budget of a cover, over F2.

Adding one triple overlap to a nerve raises the Euler characteristic by one, and
chi = H0 - H1 + H2, so it must either drop H1 by one or raise H2 by one. Never
both and never neither. So a triple overlap does not remove an obstruction. It
moves one from monodromy to coherence, or the other way when it is emptied.
"""

def rank2(rows):
    piv, r = {}, 0
    for row in rows:
        row = set(row)
        while row:
            c = min(row)
            if c in piv:
                row ^= piv[c]
            else:
                piv[c] = row; r += 1; break
    return r

def betti(V, E, F):
    S0, S1, S2 = [(v,) for v in sorted(V)], sorted(E), sorted(F)
    def bnd(hi, lo):
        idx = {s: i for i, s in enumerate(lo)}
        return [[idx[tuple(s[:i] + s[i+1:])] for i in range(len(s))] for s in hi]
    r1 = rank2(bnd(S1, S0)) if S1 else 0
    r2 = rank2(bnd(S2, S1)) if S2 else 0
    b0, b1, b2 = len(S0) - r1, (len(S1) - r1) - r2, len(S2) - r2
    return b0, b1, b2, len(S0) - len(S1) + len(S2), len(S1), len(S2)

def show(name, V, E, F):
    b0, b1, b2, chi, ne, nf = betti(V, E, F)
    print(f"  {name:44} E={ne} F={nf}  chi={chi:3}   H1={b1}  H2={b2}   classes={2**b1}")

V = {0, 1, 2, 3}                                  # A B C D
cyc = [(0, 1), (1, 2), (2, 3), (0, 3)]            # A-B, B-C, C-D, D-A
diag = cyc + [(0, 2)]                             # plus the A-C diagonal

print("=== four patches: A-B, B-C, C-D, D-A all federate, and A-C does not ===")
show("no A-C relation at all",                V, cyc,  [])
show("A-C exists, triple overlaps ALL empty", V, diag, [])
show("A-C exists, triple ABC nonempty",       V, diag, [(0, 1, 2)])
show("A-C exists, triples ABC and ACD",       V, diag, [(0, 1, 2), (0, 2, 3)])

print("\n=== the other branch: a face can raise H2 instead of dropping H1 ===")
tet = [(0, 1), (0, 2), (0, 3), (1, 2), (1, 3), (2, 3)]
show("tetrahedron, 3 of its 4 faces", V, tet, [(0,1,2), (0,1,3), (0,2,3)])
show("tetrahedron, all 4 faces",      V, tet, [(0,1,2), (0,1,3), (0,2,3), (1,2,3)])
