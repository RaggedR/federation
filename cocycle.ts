// cocycle.ts — the smallest non-trivial first cohomology, as a container.
//
// Cover the circle with three arcs, each slightly over a third, so that every
// pairwise overlap is a single arc and the triple overlap is empty. Take
// coefficients in Z/2 = {+1,-1}, written multiplicatively.
//
//     C0 = C1 = (Z/2)^3,  C2 = 0
//     (d0 a)_ij = a_i a_j,  ker d0 = the constants, so B1 has rank 2
//     Z1 = C1, because d1 lands in 0
//     => H1 = Z/2
//
// and B1 is exactly the subgroup where the product of the three edges is +1.
// So there are two classes and no more. Product +1 is the cylinder. Product -1
// is the Mobius band.
//
// Nothing in this file does IO. The whole of the mathematics is checkable with
// no server running, so that when a server IS running the only new thing is
// the wire.

import type { Fib } from "./lib/algebra.ts";

// ── The cover ─────────────────────────────────────────────────────────
// Three arcs. Not two: with two arcs the overlap has two components and the
// rank computation is different. Not four: four is the refinement where the
// cocycle condition starts to bite, and that is a different demonstration.

export const NODES = 3 as const;
export const PORT0 = 8811;

export type Sign = 1 | -1;
export type NodeId = 0 | 1 | 2;
export type Dir = "cw" | "ccw";

/** The transition data, indexed by edge: [g01, g12, g20]. A treaty is a g_ij. */
export type Cocycle = readonly [Sign, Sign, Sign];

/** A 0-chain: one local value per member, each in that member's own frame. */
export type Chain0 = readonly [Sign, Sign, Sign];

export const CYLINDER: Cocycle = [1, 1, 1];
export const MOBIUS: Cocycle = [1, 1, -1];

// ── Getting about the ring ────────────────────────────────────────────
// Node i's clockwise neighbour is i+1 and the edge between them is edges[i].
// Its anticlockwise neighbour is i+2 and that edge is edges[i+2]. In Z/2 every
// element is its own inverse, so g_ji = g_ij^-1 is invisible here: cw and ccw
// give the same sign. That is correct and it is worth knowing, because it means
// this model cannot distinguish a loop from its inverse.

export const step = (i: NodeId, dir: Dir): NodeId =>
  ((dir === "cw" ? i + 1 : i + 2) % 3) as NodeId;

/** The transition function on the edge node i crosses going `dir`. */
export const epsilon = (g: Cocycle, i: NodeId, dir: Dir): Sign =>
  dir === "cw" ? g[i] : g[(i + 2) % 3];

// ── The class ─────────────────────────────────────────────────────────

/** The product around the loop. This is the whole invariant. */
export const holonomy = (g: Cocycle): Sign => (g[0] * g[1] * g[2]) as Sign;

export type Klass = "cylinder" | "mobius";
export const classOf = (g: Cocycle): Klass =>
  holonomy(g) === 1 ? "cylinder" : "mobius";

/** How many global sections the TWISTED sheaf has. Two when the class is
 *  trivial, none when it is not. Note the qualifier: the constant sheaf Z/2
 *  always has its two constant sections, and saying otherwise would be false.
 *  What is obstructed is the sheaf glued by g. */
export const twistedSections = (g: Cocycle): 0 | 2 =>
  holonomy(g) === 1 ? 2 : 0;

// ── Coboundaries, which is the "modulo" half of H1 ────────────────────

/** d0. Flipping a member's own frame changes the two edges at that member and
 *  leaves the product alone, which is why the class is a property of the
 *  federation rather than of anybody's choice of frame. */
export const coboundary = (a: Chain0): Cocycle =>
  [(a[0] * a[1]) as Sign, (a[1] * a[2]) as Sign, (a[2] * a[0]) as Sign] as const;

export const isCoboundary = (g: Cocycle): boolean => holonomy(g) === 1;

/** Change of frame at one member. `gauge` moves the cocycle and fixes the class. */
export function gauge(g: Cocycle, i: NodeId): Cocycle {
  const a: Sign[] = [1, 1, 1];
  a[i] = -1;
  const d = coboundary(a as unknown as Chain0);
  return [(g[0] * d[0]) as Sign, (g[1] * d[1]) as Sign, (g[2] * d[2]) as Sign] as const;
}

// ── Sections, and what a cut costs ────────────────────────────────────

/** Cut one edge, root the result, and propagate. The ring minus an edge is a
 *  path, so this always terminates and always succeeds. That is the ORIENT
 *  repair, and the price is visible in `sectionsDisagreeBy` below. */
export function sectionAlong(
  g: Cocycle,
  cut: 0 | 1 | 2,
  root: NodeId,
  rootValue: Sign,
): Chain0 {
  const x: Sign[] = [1, 1, 1];
  x[root] = rootValue;
  const seen = new Set<NodeId>([root]);
  let frontier: NodeId[] = [root];
  while (frontier.length > 0) {
    const next: NodeId[] = [];
    for (const i of frontier) {
      for (const dir of ["cw", "ccw"] as const) {
        const edge = dir === "cw" ? i : ((i + 2) % 3);
        if (edge === cut) continue;
        const j = step(i, dir);
        if (seen.has(j)) continue;
        seen.add(j);
        x[j] = (epsilon(g, i, dir) * x[i]) as Sign;
        next.push(j);
      }
    }
    frontier = next;
  }
  return x as unknown as Chain0;
}

/** Two sections built from two different cuts, same root and same root value,
 *  differ exactly by the class. On the cylinder every cut agrees. On the
 *  Mobius band any two cuts disagree, and the disagreement IS the holonomy.
 *  Changing the ROOT only gauges the section globally and is not observable;
 *  only changing the CUT is. */
export const sectionsDisagreeBy = (g: Cocycle, cutA: 0 | 1 | 2, cutB: 0 | 1 | 2): Sign => {
  const a = sectionAlong(g, cutA, 0, 1);
  const b = sectionAlong(g, cutB, 0, 1);
  const differ = a.some((v, i) => v !== b[i]);
  return (differ ? -1 : 1) as Sign;
};

// ── Path independence ─────────────────────────────────────────────────
// NOT "do the operations commute". Z/2 is abelian, so order never mattered, in
// either class. What distinguishes the two is whether the two routes between
// the same pair of members agree, which is monodromy rather than commutativity.

/** The product of the transition functions along `n` steps from `i`. */
export function pathProduct(g: Cocycle, from: NodeId, dir: Dir, hops: number): Sign {
  let acc: Sign = 1;
  let at = from;
  for (let k = 0; k < hops; k++) {
    acc = (acc * epsilon(g, at, dir)) as Sign;
    at = step(at, dir);
  }
  return acc;
}

/** The short way from 0 to 1 against the long way round. Equal iff trivial. */
export const pathIndependent = (g: Cocycle): boolean =>
  pathProduct(g, 0, "cw", 1) === pathProduct(g, 0, "ccw", 2);

// ── The nerve, printed, so nobody mistakes what is being verified ─────
// With an empty triple overlap the cocycle condition g_ij g_jk = g_ik is
// vacuous. This demonstration exhibits monodromy. It does NOT exercise
// coherence, and a reader who has just read the sheaf note will assume it does.

export const nerve = () => ({
  arcs: NODES,
  c0: 3,
  c1: 3,
  c2: 0,
  z1: 3,
  b1: 2,
  h1: "Z/2",
  cocycleConditionIsVacuous: true,
});

// ── The container ─────────────────────────────────────────────────────
// Each node presents this interface. It is also a morphism, because it answers
// a delegating prompt by prompting its neighbour and applying its own edge
// transition to the reply. The sign is applied on the way back and nowhere
// else, which is the only position descent allows it to occupy.
//
// One consequence to state rather than hide: the forward map is near-identity
// here, so every edge is a vertical morphism, an element of the automorphism
// sheaf. That is exactly right for descent and it is a degenerate corner of the
// container formalism. Giving the forward map real work is a documented
// extension, not a fix.

export interface LocalReport { node: NodeId; value: Sign }
export interface EdgeReport { node: NodeId; cw: Sign; ccw: Sign }
export interface Ack { ok: true }
export interface Carried { value: Sign; hops: number; path: NodeId[] }
export type Bounded =
  | { tag: "Carried"; value: Sign; path: NodeId[] }
  | { tag: "Exhausted"; path: NodeId[] };
/** A walk around a finite ring always closes, so there is no carried branch.
 *  The closing node returns the empty product and every frame on the way back
 *  multiplies by its own edge. The holonomy is therefore accumulated entirely
 *  in the backward maps, which is the only place descent permits it. */
export interface LoopClosed { loop: NodeId[]; holonomy: Sign }

export type NodeC =
  | Fib<{ tag: "Local" }, LocalReport>
  | Fib<{ tag: "Edges" }, EdgeReport>
  | Fib<{ tag: "Configure"; edges: Cocycle; value: Sign }, Ack>
  | Fib<{ tag: "Ask"; dir: Dir; fuel: number }, Carried>
  | Fib<{ tag: "Unroll"; dir: Dir; fuel: number }, Bounded>
  | Fib<{ tag: "Orient"; dir: Dir }, Carried>
  | Fib<{ tag: "Walk"; dir: Dir; visited: NodeId[] }, LoopClosed>;

export type MobPrompt =
  | { tag: "Local" }
  | { tag: "Edges" }
  | { tag: "Configure"; edges: Cocycle; value: Sign }
  | { tag: "Ask"; dir: Dir; fuel: number }
  | { tag: "Unroll"; dir: Dir; fuel: number }
  | { tag: "Orient"; dir: Dir }
  | { tag: "Walk"; dir: Dir; visited: NodeId[] };

// ── Guards ────────────────────────────────────────────────────────────
// Inlined rather than imported from state.ts, which is the game's domain. The
// point of this demonstration is that the algebra does not care what it is
// carrying, and importing grain and steel to validate a sign would contradict
// it in the first line.

export const isRecord = (u: unknown): u is Record<string, unknown> =>
  typeof u === "object" && u !== null && !Array.isArray(u);
export const isSign = (u: unknown): u is Sign => u === 1 || u === -1;
export const isNodeId = (u: unknown): u is NodeId => u === 0 || u === 1 || u === 2;
export const isDir = (u: unknown): u is Dir => u === "cw" || u === "ccw";
export const isCocycle = (u: unknown): u is Cocycle =>
  Array.isArray(u) && u.length === 3 && u.every(isSign);

export function parseSigns(s: string): Cocycle | null {
  const parts = s.split(",").map((t) => t.trim());
  if (parts.length !== 3) return null;
  const out: Sign[] = [];
  for (const p of parts) {
    if (p === "+" || p === "+1" || p === "1") out.push(1);
    else if (p === "-" || p === "-1") out.push(-1);
    else return null;
  }
  return out as unknown as Cocycle;
}

export const showSigns = (g: Cocycle): string =>
  g.map((s) => (s === 1 ? "+" : "-")).join(",");
