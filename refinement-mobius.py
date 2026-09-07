# Myhill-Nerode refinement on the path directed container of the directed 3-cycle,
# exactly as sec:partition-refinement describes it: group paths by end vertex, then
# split by comparing continuation tables one level deeper until nothing splits.
N, L = 3, 400

def run(g, x0=1, name=""):
    paths = list(range(L))                       # path a^k, from vertex 0
    end   = lambda k: k % N
    def label(k):
        v = x0
        for i in range(k): v *= g[i % N]
        return v
    lab = {k: label(k) for k in paths}

    cls = {k: (end(k),) for k in paths}          # step 0: group by end vertex
    counts = []
    for step in range(30):
        counts.append(len(set(cls.values())))
        # one level deeper: a path's class refines by the class of its extension
        nxt = {k: (cls[k], lab[k], cls[k+1] if k+1 < L else None) for k in paths[:-1]}
        # relabel to canonical ids
        ids = {v: i for i, v in enumerate(sorted(set(nxt.values()), key=str))}
        new = {k: (ids[nxt[k]],) for k in paths[:-1]}
        paths = paths[:-1]
        cls = {k: new[k] for k in paths}
        if counts[-1] == len(set(cls.values())) and step > 2: break
    stable = len(set(cls.values()))
    reachable = sorted({(end(k), label(k)) for k in range(6 * N)})
    print(f"{name:10} signs={g}  class count by step: {counts[:8]}")
    print(f"{'':10} stabilises at {stable} classes;  reachable (vertex,value) pairs: {len(reachable)}")
    print(f"{'':10} {reachable}")
    # the quotient graph: transition on (vertex, value)
    trans = {p: ((p[0]+1) % N, p[1]*g[p[0]]) for p in reachable}
    cyc, seen, cur = [], set(), reachable[0]
    while cur not in seen:
        seen.add(cur); cyc.append(cur); cur = trans[cur]
    print(f"{'':10} quotient is a single cycle of length {len(cyc)}: {cyc}\n")

run([1, 1, -1], name="mobius")
run([1, 1,  1], name="cylinder")
