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

// The base has three arcs and keeps them. An n-fold cover of the circle pulls a
// 3-arc cover back to 3n arcs, so the ring the servers actually form is three
// nodes long or six, and every function below takes the modulus as a parameter
// rather than assuming it. A position in that ring is a RingId. The base's
// NodeId is the n = 1 case, and the type test asserting exactly three arcs is
// about the base, so it stays.

export type RingId = number;
export type RingSigns = readonly Sign[];

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

/** One hop, in a ring of `n` nodes. */
export const stepIn = (n: number, i: RingId, dir: Dir): RingId =>
  dir === "cw" ? (i + 1) % n : (i + n - 1) % n;

export const step = (i: NodeId, dir: Dir): NodeId => stepIn(NODES, i, dir) as NodeId;

/** The transition function on the edge node i crosses going `dir`. The modulus
 *  is read off the data rather than passed alongside it, so a three-node ring
 *  and a six-node ring cannot disagree about how long they are. */
export const epsilonIn = (g: RingSigns, i: RingId, dir: Dir): Sign =>
  dir === "cw" ? g[i] : g[(i + g.length - 1) % g.length];

export const epsilon = (g: Cocycle, i: NodeId, dir: Dir): Sign => epsilonIn(g, i, dir);

// ── The class ─────────────────────────────────────────────────────────

/** The product around the loop. This is the whole invariant. */
export const holonomyOf = (g: RingSigns): Sign =>
  g.reduce((a, b) => (a * b) as Sign, 1 as Sign);

export const holonomy = (g: Cocycle): Sign => holonomyOf(g);

export type Klass = "cylinder" | "mobius";
export const classOfRing = (g: RingSigns): Klass =>
  holonomyOf(g) === 1 ? "cylinder" : "mobius";
export const classOf = (g: Cocycle): Klass => classOfRing(g);

/** How many global sections the TWISTED sheaf has. Two when the class is
 *  trivial, none when it is not. Note the qualifier: the constant sheaf Z/2
 *  always has its two constant sections, and saying otherwise would be false.
 *  What is obstructed is the sheaf glued by g. */
export const twistedSectionsOf = (g: RingSigns): 0 | 2 =>
  holonomyOf(g) === 1 ? 2 : 0;
export const twistedSections = (g: Cocycle): 0 | 2 => twistedSectionsOf(g);

// ── Coboundaries, which is the "modulo" half of H1 ────────────────────

/** d0. Flipping a member's own frame changes the two edges at that member and
 *  leaves the product alone, which is why the class is a property of the
 *  federation rather than of anybody's choice of frame. */
export const coboundaryOf = (a: RingSigns): RingSigns =>
  a.map((v, i) => (v * a[(i + 1) % a.length]) as Sign);

export const coboundary = (a: Chain0): Cocycle =>
  coboundaryOf(a) as unknown as Cocycle;

export const isCoboundary = (g: RingSigns): boolean => holonomyOf(g) === 1;

/** Change of frame at one member. `gauge` moves the cocycle and fixes the class. */
export function gaugeIn(g: RingSigns, i: RingId): RingSigns {
  const a: Sign[] = g.map(() => 1 as Sign);
  a[i] = -1;
  const d = coboundaryOf(a);
  return g.map((v, k) => (v * d[k]) as Sign);
}

export const gauge = (g: Cocycle, i: NodeId): Cocycle =>
  gaugeIn(g, i) as unknown as Cocycle;

// ── Sections, and what a cut costs ────────────────────────────────────

/** Cut one edge, root the result, and propagate. The ring minus an edge is a
 *  path, so this always terminates and always succeeds. That is the ORIENT
 *  repair, and the price is visible in `sectionsDisagreeBy` below. */
export function sectionAlongRing(
  g: RingSigns,
  cut: number,
  root: RingId,
  rootValue: Sign,
): RingSigns {
  const n = g.length;
  const x: Sign[] = g.map(() => 1 as Sign);
  x[root] = rootValue;
  const seen = new Set<RingId>([root]);
  let frontier: RingId[] = [root];
  while (frontier.length > 0) {
    const next: RingId[] = [];
    for (const i of frontier) {
      for (const dir of ["cw", "ccw"] as const) {
        const edge = dir === "cw" ? i : ((i + n - 1) % n);
        if (edge === cut) continue;
        const j = stepIn(n, i, dir);
        if (seen.has(j)) continue;
        seen.add(j);
        x[j] = (epsilonIn(g, i, dir) * x[i]) as Sign;
        next.push(j);
      }
    }
    frontier = next;
  }
  return x;
}

export const sectionAlong = (
  g: Cocycle,
  cut: 0 | 1 | 2,
  root: NodeId,
  rootValue: Sign,
): Chain0 => sectionAlongRing(g, cut, root, rootValue) as unknown as Chain0;

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
export function pathProductIn(
  g: RingSigns,
  from: RingId,
  dir: Dir,
  hops: number,
): Sign {
  let acc: Sign = 1;
  let at = from;
  for (let k = 0; k < hops; k++) {
    acc = (acc * epsilonIn(g, at, dir)) as Sign;
    at = stepIn(g.length, at, dir);
  }
  return acc;
}

export const pathProduct = (g: Cocycle, from: NodeId, dir: Dir, hops: number): Sign =>
  pathProductIn(g, from, dir, hops);

/** The short way from 0 to 1 against the long way round. Equal iff trivial. */
export const pathIndependent = (g: RingSigns): boolean =>
  pathProductIn(g, 0, "cw", 1) === pathProductIn(g, 0, "ccw", g.length - 1);

// ── The nerve, printed, so nobody mistakes what is being verified ─────
// With an empty triple overlap the cocycle condition g_ij g_jk = g_ik is
// vacuous. This demonstration exhibits monodromy. It does NOT exercise
// coherence, and a reader who has just read the sheaf note will assume it does.

export const nerveOf = (arcs: number) => ({
  arcs,
  c0: arcs,
  c1: arcs,
  c2: 0,
  z1: arcs,
  b1: arcs - 1,
  h1: "Z/2",
  cocycleConditionIsVacuous: true,
});

export const nerve = () => nerveOf(NODES);

// ── The double cover, and what a centre costs ─────────────────────────
// Pass to the universal cover and the locally constant classes vanish, because
// on a simply connected base there is no pi_1 left to represent them. Z/2 makes
// that tractable: the relevant cover has order two, so "infinitely many copies
// of the federation" is two copies and six nodes, and the whole universal cover
// fits on one machine.
//
// The n-fold cover of S^1 pulls a 3-arc cover back to 3n arcs, and the upstairs
// transition data is the downstairs data repeated: eps_i = g_(i mod 3).
//
// The holonomy upstairs is (prod g)^n, which for n = 2 is +1 in BOTH classes.
// That is not a coincidence to be explained away, and it is not the result. It
// is p*alpha = 0: alpha : pi_1(S^1) = Z -> Z/2 is m |-> m mod 2, the cover's
// pi_1 maps onto 2Z, and alpha is trivial there. So a section exists upstairs,
// always, and six hops trivialise the twist ON THE CYLINDER TOO. Anything that
// stops at the closure check has proved nothing while appearing to prove
// everything.
//
// What separates the two classes is the deck transformation. Upstairs a global
// section exists in both cases; in the trivial class the two sheets agree, and
// in the non-trivial class they do not. That comparison is the whole content,
// and it recovers the base class from a cover on which nothing is obstructed.

/** p*, the pullback of the base's transition data to the n-fold cover. */
export const pullback = (g: Cocycle, degree: number): RingSigns =>
  Array.from({ length: NODES * degree }, (_, i) => g[i % NODES]);

/** The degree of the cover that a ring of this length is, over a 3-arc base. */
export const degreeOf = (ring: number): number => ring / NODES;

/** The section, built from node 0 outwards: s_0 = rootValue, and
 *  s_(i+1) = eps_i . s_i. Upstairs this closes, in both classes. */
export const sectionUpstairs = (eps: RingSigns, rootValue: Sign = 1): RingSigns => {
  const s: Sign[] = [rootValue];
  for (let i = 1; i < eps.length; i++) s.push((eps[i - 1] * s[i - 1]) as Sign);
  return s;
};

/** Does it close? eps_last . s_last must come back to s_0. Upstairs this is
 *  true for both classes, which is exactly why it is not the result. */
export const closes = (eps: RingSigns, s: RingSigns): boolean =>
  (eps[eps.length - 1] * s[s.length - 1]) === s[0];

/** The deck transformation, sigma(i) = i + 3 mod 3n. It shifts by the size of
 *  the BASE and not by half the ring: the deck group of the n-fold cover of the
 *  circle is Z/n, and this is its generator. */
export const antipode = (i: RingId, ring: number): RingId => (i + NODES) % ring;

/** sigma*s, the section read through the deck transformation. */
export const deckImage = (s: RingSigns): RingSigns =>
  s.map((_, i) => s[antipode(i, s.length)]);

/** sigma*s = ratio . s, and the ratio is the product over the BASE. Every
 *  element of Z/2 is its own inverse, so dividing here is multiplying. */
export const deckRatio = (s: RingSigns): Sign =>
  (s[antipode(0, s.length)] * s[0]) as Sign;

/** Whether the ratio is the same at every node, so that `deckRatio` reports a
 *  global relation between the sheets rather than one node's accident. */
export const deckUniform = (s: RingSigns): boolean =>
  s.every((v, i) => (s[antipode(i, s.length)] * v) === deckRatio(s));

/** Whether every cut gives the same section. Downstairs on the Mobius band no
 *  two cuts agree, and `sectionsDisagreeBy` is where that is said. Upstairs
 *  they all agree, and that is what "it glues" means when it is checked
 *  rather than asserted. */
export const everyCutAgrees = (g: RingSigns): boolean => {
  const first = sectionAlongRing(g, 0, 0, 1);
  return g.every((_, c) =>
    sectionAlongRing(g, c, 0, 1).every((v, i) => v === first[i])
  );
};

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

export interface LocalReport { node: RingId; value: Sign }
export interface EdgeReport { node: RingId; cw: Sign; ccw: Sign }
export interface Ack { ok: true }
export interface Carried { value: Sign; hops: number; path: RingId[] }
export type Bounded =
  | { tag: "Carried"; value: Sign; path: RingId[] }
  | { tag: "Exhausted"; path: RingId[] };
/** A walk around a finite ring always closes, so there is no carried branch.
 *  The closing node returns the empty product and every frame on the way back
 *  multiplies by its own edge. The holonomy is therefore accumulated entirely
 *  in the backward maps, which is the only place descent permits it. */
export interface LoopClosed { loop: RingId[]; holonomy: Sign }

/** The deck transformation, in the ring. Node i walks `fuel` hops — three, the
 *  size of the base — and the node it arrives at is its antipode, the other
 *  sheet over the same arc. Two things travel back along that one walk, under
 *  two different backward maps. `transported` is carried by the SAME map as
 *  `Ask`, multiplying by eps at every frame. `theirs` is relayed untouched,
 *  because the covering map identifies the fibre at i + 3 with the fibre at i
 *  and that identification is the identity, not a transition function. The
 *  nodes in between may carry `theirs` but cannot read it: it is a value in a
 *  frame that is not theirs, since they lie over a different arc of the base.
 *
 *  Both maps are honest and they disagree, and what they disagree by is the
 *  class of the base. That is the point of the whole fibre. Note also what it
 *  is NOT: `transported` on its own always agrees with the far node, because
 *  transport round three hops is exactly what built the section, so a fibre
 *  reporting only `transported` would print the same thing in both classes. */
export interface DeckReport {
  node: RingId;
  antipode: RingId;
  transported: Sign;
  theirs: Sign;
  agree: boolean;
}

export type NodeC =
  | Fib<{ tag: "Local" }, LocalReport>
  | Fib<{ tag: "Edges" }, EdgeReport>
  | Fib<{ tag: "Configure"; edges: RingSigns; value: Sign }, Ack>
  | Fib<{ tag: "Ask"; dir: Dir; fuel: number }, Carried>
  | Fib<{ tag: "Unroll"; dir: Dir; fuel: number }, Bounded>
  | Fib<{ tag: "Orient"; dir: Dir }, Carried>
  | Fib<{ tag: "Walk"; dir: Dir; visited: RingId[] }, LoopClosed>
  | Fib<{ tag: "Deck"; dir: Dir; fuel: number }, DeckReport>;

export type MobPrompt =
  | { tag: "Local" }
  | { tag: "Edges" }
  | { tag: "Configure"; edges: RingSigns; value: Sign }
  | { tag: "Ask"; dir: Dir; fuel: number }
  | { tag: "Unroll"; dir: Dir; fuel: number }
  | { tag: "Orient"; dir: Dir }
  | { tag: "Walk"; dir: Dir; visited: RingId[] }
  | { tag: "Deck"; dir: Dir; fuel: number };

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

/** A position in a ring of `ring` nodes. On the double cover the ids run to 5,
 *  so `isNodeId` is not the guard the servers want. */
export const isRingId = (u: unknown, ring: number): u is RingId =>
  typeof u === "number" && Number.isInteger(u) && u >= 0 && u < ring;

export const isRingSigns = (u: unknown, ring: number): u is RingSigns =>
  Array.isArray(u) && u.length === ring && u.every(isSign);

/** Transition data for a ring of any length that is a cover of a 3-arc base.
 *  A length that is not a multiple of three is not a cover of this base, and
 *  saying so here is cheaper than discovering it three hops in. */
export function parseRing(s: string): RingSigns | null {
  const parts = s.split(",").map((t) => t.trim());
  if (parts.length < NODES || parts.length % NODES !== 0) return null;
  const out: Sign[] = [];
  for (const p of parts) {
    if (p === "+" || p === "+1" || p === "1") out.push(1);
    else if (p === "-" || p === "-1") out.push(-1);
    else return null;
  }
  return out;
}

export function parseSigns(s: string): Cocycle | null {
  const r = parseRing(s);
  return r !== null && r.length === NODES ? (r as unknown as Cocycle) : null;
}

export const showRing = (g: RingSigns): string =>
  g.map((s) => (s === 1 ? "+" : "-")).join(",");

export const showSigns = (g: Cocycle): string => showRing(g);
