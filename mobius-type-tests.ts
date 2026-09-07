// mobius-type-tests.ts — the cohomology, asserted against the compiler.
//
// Checked, never run. Every `@ts-expect-error` asserts that the next line IS an
// error; TypeScript reports an unused directive as an error in its own right,
// so this file fails both if a true statement is rejected and if a false one is
// accepted.
//
// The first section is the point of the whole exercise. The rest computes H1 by
// enumeration, in the checker, over all eight 0-chains.

import type {
  Ack,
  Bounded,
  Carried,
  Chain0,
  DeckReport,
  EdgeReport,
  LocalReport,
  LoopClosed,
  NodeC,
  Sign,
} from "./cocycle.ts";
import { leaf, type PosAt, type Runner, seqC } from "./lib/algebra.ts";

const expect = <T>(_x: T): void => {};

// ── 1. The missing trace, as a diagnostic ─────────────────────────────
// `◁` composes containers into trees. A federation is a ring, and a ring is not
// a tree. This is that claim, stated to the compiler.

const decoders = {
  Local: (u: unknown) => u as LocalReport,
  Edges: (u: unknown) => u as EdgeReport,
  Configure: (u: unknown) => u as Ack,
  Ask: (u: unknown) => u as Carried,
  Unroll: (u: unknown) => u as Bounded,
  Orient: (u: unknown) => u as Carried,
  Walk: (u: unknown) => u as LoopClosed,
  Deck: (u: unknown) => u as DeckReport,
};

const n0 = leaf<NodeC>("n0", 8811, decoders);
const n1 = leaf<NodeC>("n1", 8812, decoders);
const n2 = leaf<NodeC>("n2", 8813, decoders);

// A path composes. Three arcs in a row are a tree, and `◁` is happy.
const path = seqC(n0, seqC(n1, n2));
expect<string>(path.label);

// @ts-expect-error  closing the loop is not a program that can be written down
const ring = seqC(n2, ring);

// And the same obstruction bought back with a thunk. This compiles, because the
// annotation supplies what inference could not find, and it does not terminate.
// The interface is well typed. The composite is not well founded. Containers
// type the first and say nothing about the second, which is the entire finding.
const lazyRing: Runner<NodeC> = {
  label: "ring",
  run: <S extends { tag: string }>(s: S, d: number) => lazyRing.run(s as never, d),
};
expect<string>(lazyRing.label);

// ── 2. H1 = Z/2, by enumeration, in the checker ───────────────────────

type Neg<S extends Sign> = S extends 1 ? -1 : 1;
type Mul<A extends Sign, B extends Sign> = B extends 1 ? A : Neg<A>;
type Prod<T extends Chain0> = Mul<Mul<T[0], T[1]>, T[2]>;

/** d0 : C0 -> C1. */
type Cob<A extends Chain0> = [Mul<A[0], A[1]>, Mul<A[1], A[2]>, Mul<A[2], A[0]>];

// The two named classes.
expect<Prod<[1, 1, 1]>>(1); // cylinder
expect<Prod<[1, 1, -1]>>(-1); // mobius
// @ts-expect-error  the Mobius band is not trivial, and this is where it is said
expect<Prod<[1, 1, -1]>>(1);

// B1 is contained in the product-+1 subgroup. All eight 0-chains, no sampling.
expect<Prod<Cob<[1, 1, 1]>>>(1);
expect<Prod<Cob<[1, 1, -1]>>>(1);
expect<Prod<Cob<[1, -1, 1]>>>(1);
expect<Prod<Cob<[1, -1, -1]>>>(1);
expect<Prod<Cob<[-1, 1, 1]>>>(1);
expect<Prod<Cob<[-1, 1, -1]>>>(1);
expect<Prod<Cob<[-1, -1, 1]>>>(1);
expect<Prod<Cob<[-1, -1, -1]>>>(1);

// @ts-expect-error  and no coboundary is ever the non-trivial class
expect<Prod<Cob<[1, -1, 1]>>>(-1);

// Gauge fixes the class: flipping node 0 changes edges 01 and 20, not the product.
type Gauged<G extends Chain0, A extends Chain0> = [
  Mul<G[0], Cob<A>[0]>,
  Mul<G[1], Cob<A>[1]>,
  Mul<G[2], Cob<A>[2]>,
];
expect<Prod<Gauged<[1, 1, -1], [-1, 1, 1]>>>(-1);
// @ts-expect-error  a change of frame cannot make a Mobius band into a cylinder
expect<Prod<Gauged<[1, 1, -1], [-1, 1, 1]>>>(1);

// ── 3. The transition function acts on responses, never on prompts ────
// This is the one a category theorist reads. The sign lives in the backward
// map, so it has type R -> R and there is no way to apply it forwards.

type AskShape = { tag: "Ask"; dir: "cw"; fuel: 3 };
type Backward = (r: PosAt<NodeC, AskShape>) => PosAt<NodeC, AskShape>;

const twist: Backward = (r) => ({ ...r, value: (r.value * -1) as Sign });
expect<PosAt<NodeC, AskShape>>(twist({ value: 1, hops: 0, path: [] }));

// @ts-expect-error  it does not act on the prompt, and cannot be made to
const misapplied = twist({ tag: "Ask", dir: "cw", fuel: 3 });

// ── 4. Fuel is part of the prompt, so the response depends on it ──────
// F^0 of bottom is bottom. This assertion is only available because fuel rides
// in the prompt rather than in the depth header: a header cannot be a type.

type UnrollAt<N extends number> = N extends 0 ? Extract<Bounded, { tag: "Exhausted" }>
  : Bounded;

expect<UnrollAt<0>["tag"]>("Exhausted");
// @ts-expect-error  nothing is carried at fuel zero
expect<UnrollAt<0>["tag"]>("Carried");
expect<UnrollAt<3>["tag"]>("Carried");

// ── 5. The cover has exactly three arcs ───────────────────────────────
// Two arcs and the overlap has two components. Four and the triple overlap is
// non-empty. Either changes the rank computation, so the count is in the type.

expect<Chain0>([1, 1, -1]);
// @ts-expect-error  two arcs is a different space
expect<Chain0>([1, -1]);
// @ts-expect-error  and four is a different computation
expect<Chain0>([1, 1, 1, -1]);

// ── 5a. The double cover, and p*alpha = 0, in the checker ─────────────
// The n-fold cover of S^1 pulls a 3-arc cover back to 3n arcs, with the
// upstairs data the downstairs data repeated. For n = 2 that is six.

type Pullback<G extends Chain0> = [G[0], G[1], G[2], G[0], G[1], G[2]];
type Prod6<T extends [Sign, Sign, Sign, Sign, Sign, Sign]> = Mul<
  Mul<Mul<Mul<Mul<T[0], T[1]>, T[2]>, T[3]>, T[4]>,
  T[5]
>;

// 3n arcs for n = 2.
expect<Pullback<[1, 1, -1]>["length"]>(6);
// @ts-expect-error  the cover is not the base, and it is not three arcs
expect<Pullback<[1, 1, -1]>["length"]>(3);

// p*alpha = 0. The product upstairs is +1 for BOTH classes, which is why the
// closure check separates nothing and why a section exists at all.
expect<Prod6<Pullback<[1, 1, 1]>>>(1);
expect<Prod6<Pullback<[1, 1, -1]>>>(1);
// @ts-expect-error  the twist really is dead upstairs, in the non-trivial class too
expect<Prod6<Pullback<[1, 1, -1]>>>(-1);

// The section upstairs, s_0 = +1 and s_(i+1) = eps_i . s_i, written out.
type Sec<G extends Chain0> = [
  1,
  G[0],
  Mul<G[0], G[1]>,
  Prod<G>,
  Mul<Prod<G>, G[0]>,
  Mul<Mul<Prod<G>, G[0]>, G[1]>,
];

// It closes: eps_5 . s_5 = s_0 = +1. Both classes, and this is the assertion a
// reader must NOT stop at.
type Closes<G extends Chain0> = Mul<G[2], Sec<G>[5]>;

expect<Closes<[1, 1, 1]>>(1);
expect<Closes<[1, 1, -1]>>(1);

// And the deck transformation, sigma(i) = i + 3, which is where the two classes
// finally part: sigma*s = (prod g) . s, so the ratio IS the base class,
// recovered from a cover on which nothing is obstructed.
type DeckRatio<G extends Chain0> = Mul<Sec<G>[3], Sec<G>[0]>;

expect<DeckRatio<[1, 1, 1]>>(1);
expect<DeckRatio<[1, 1, -1]>>(-1);
// @ts-expect-error  on the Mobius band the two sheets do not agree
expect<DeckRatio<[1, 1, -1]>>(1);

// ── 6. The coefficients are Z/2 ───────────────────────────────────────

expect<Sign>(1);
expect<Sign>(-1);
// @ts-expect-error  there is no zero in a group of units
expect<Sign>(0);
// @ts-expect-error  nor a two
expect<Sign>(2);

// ── 7. The dependent lookup, house style ──────────────────────────────
// Positions over one prompt, not the union of all of them.

expect<PosAt<NodeC, { tag: "Edges" }>>({ node: 0, cw: 1, ccw: -1 });
// @ts-expect-error  hops belongs to a different fibre
expect<PosAt<NodeC, { tag: "Edges" }>>({ node: 0, cw: 1, ccw: -1, hops: 3 });
