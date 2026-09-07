from itertools import product

def states(V, edges, v0, x0, cap=100000):
    """Reachable (vertex, value) pairs = the Myhill-Nerode classes of a fold labelling."""
    seen, frontier = {(v0, x0)}, [(v0, x0)]
    while frontier and len(seen) < cap:
        nxt = []
        for (v, x) in frontier:
            for (s, t, f) in edges:
                if s != v: continue
                st = (t, f(x))
                if st not in seen: seen.add(st); nxt.append(st)
        frontier = nxt
    return seen

def ring(n, mod):
    """directed n-cycle, additive coefficients in Z/mod, one twist on the last edge"""
    V = list(range(n))
    edges = [(i, (i+1) % n, (lambda x, k=(1 if i == n-1 else 0): (x+k) % mod)) for i in range(n)]
    return V, edges

print("=== the minimal cover, for a 3-cycle with holonomy of order m ===")
for mod in (1, 2, 3, 4, 6):
    V, E = ring(3, mod)
    s = states(V, E, 0, 0)
    print(f"  Z/{mod}: holonomy order {mod:2}   classes {len(s):3}   = 3 x {len(s)//3}")

print("\n=== figure-8: two independent loops, Z/2 coefficients ===")
V8 = [0]
E8 = [(0, 0, lambda x: x), (0, 0, lambda x: (x+1) % 2)]
print(f"  minimal cover: {len(states(V8, E8, 0, 0))} classes")
print("  universal cover of the figure-8 is the infinite 4-regular tree")

print("\n=== a labelling that is NOT a fold: Fibonacci word on the one-loop graph ===")
def fib_word(L):
    a, b = "0", "01"
    while len(b) < L: a, b = b, b + a
    return b[:L]
w = fib_word(200000)
for n in (0, 1, 2, 3, 5, 9, 13, 17, 21, 25):
    c = len({w[i:i+n+1] for i in range(len(w)-n-1)})
    print(f"  c({n:2}) = {c:3}   (n+2 = {n+2})")
