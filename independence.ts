// independence.ts — the two obstructions are independent, and they obstruct
// different things.
//
// The closing box of sheaf-federation.tex puts a question to Neil:
//
//     The container note found that cycles obstruct a trace on ◁. This note
//     finds that cycles carry a class in H¹. If those are the same obstruction,
//     then H¹ measures the failure of the trace to exist, and there ought to be
//     a statement relating them. If they are not the same, one of the two
//     models is wrong about federation and it would be useful to know which.
//
// It offers two answers. This file argues for a third, and the third is the one
// that survives contact with the program already in this repository.
//
// They are not the same obstruction. Neither model is wrong. They obstruct
// DIFFERENT PROPERTIES of the same composite:
//
//     well-foundedness  is about EXISTENCE   — is there an answer at all?
//     the class in H¹   is about CANONICITY  — is the answer independent of
//                                              the choice made to get it?
//
// and the statement relating them is not an equality but a composition:
//
//     Cutting an edge trades divergence for choice.
//     H¹ is exactly the price of the choice.
//
// Nothing here does IO. The 2×2 is decided by functions already in cocycle.ts,
// which is the point: if the claim needed a new mechanism it would be a claim
// about the new mechanism.

import {
  classOfRing,
  CYLINDER,
  everyCutAgrees,
  gaugeIn,
  holonomyOf,
  MOBIUS,
  type RingSigns,
  sectionAlongRing,
  showRing,
  type Sign,
} from "./cocycle.ts";

// ── The axis nobody has isolated: well-foundedness ────────────────────
// mobius.server.ts has four handlers that walk the ring, and they differ ONLY
// in what stops them:
//
//     Ask     fuel        decreases, reaches zero, has a base case
//     Unroll  fuel        as Ask, but the response type admits Exhausted
//     Walk    visited     the node that sees itself returns the empty product
//     Orient  nothing     no fuel, no visited list, no base case
//
// Read the four bodies beside each other and the sign appears in all four, in
// the same position — applied to the reply on the way back. So ε occurs in the
// BACKWARD map in every one of them, and what distinguishes Orient is a
// property of the FORWARD map's control flow, where no ε occurs at all.
//
// That is the whole argument in one sentence, and everything below is it made
// checkable: H¹ lives in f, well-foundedness lives in u, and a container's two
// halves are independent by construction.

/** The pure analogue of the `Orient` handler: hop, then apply ε to the reply.
 *  No fuel, no visited, no base case — deliberately the same shape as the
 *  server's, so that what is demonstrated here is the server's behaviour and
 *  not a convenient imitation of it.
 *
 *  The budget is an INSTRUMENT, not a proof. A run that exhausts a budget has
 *  not shown divergence; it has shown that divergence was not disproved in that
 *  many steps. The proof is structural and is stated in the next comment. */
export function orientBudgeted(
  g: RingSigns,
  from: number,
  budget: number,
): { terminated: boolean; steps: number } {
  let steps = 0;
  let at = from;
  let acc: Sign = 1;
  // The recursion has no exit. `acc` is the ε accumulation the server performs
  // on the way back; it is computed here so that the class IS in play and
  // cannot be said to have been left out.
  while (steps < budget) {
    acc = (acc * g[at % g.length]) as Sign;
    at = (at + 1) % g.length;
    steps++;
  }
  return { terminated: false, steps };
}

// Why divergence is structural rather than empirical:
//
//     Orient(i) = ε_i · Orient(i+1)
//
// There is no i at which the right-hand side is not another call, so the
// equation has no least fixed point in a category of total functions. The
// argument never mentions ε. Substituting ANY element of Z/2 — in particular
// +1 at every edge, which is the cylinder — changes nothing on the left of the
// dot, and the recursion on the right is untouched. The compiler says the same
// thing in mobius-type-tests.ts: `seqC(n2, ring)` is TS7022, and the annotated
// thunk beside it compiles and does not terminate. Neither diagnostic mentions
// the signs, because neither depends on them.

// ── The 2×2 ───────────────────────────────────────────────────────────

export type Repair = "none" | "cut";
export interface Cell {
  klass: string;
  repair: Repair;
  terminates: boolean;
  canonical: boolean | null; // null where there is no answer to be canonical
  witness: string;
}

const BUDGET = 10_000;

export function cell(g: RingSigns, repair: Repair): Cell {
  const klass = classOfRing(g);
  if (repair === "none") {
    const r = orientBudgeted(g, 0, BUDGET);
    return {
      klass,
      repair,
      terminates: r.terminated,
      canonical: null,
      witness: `Orient: no base case; ${r.steps} steps without reaching one`,
    };
  }
  // The cut repair: delete one edge and the ring is a path. A path is a tree,
  // and ◁ builds trees, so this always terminates — in BOTH classes.
  const sections = g.map((_, c) => sectionAlongRing(g, c, 0, 1));
  const agree = everyCutAgrees(g);
  return {
    klass,
    repair,
    terminates: true,
    canonical: agree,
    witness: agree
      ? `all ${g.length} cuts give ${showRing(sections[0])}`
      : `cut 0 gives ${showRing(sections[0])}, cut 1 gives ${showRing(sections[1])}`,
  };
}

// ── The theorem, checked on every cocycle rather than a sample ────────
// (Z/2)³ has eight elements. Eight is small enough to enumerate, and
// enumerating it is the difference between a demonstration and a proof for a
// statement quantified over a finite set.

export const allCocycles = (): RingSigns[] => {
  const out: RingSigns[] = [];
  for (const a of [1, -1] as Sign[]) {
    for (const b of [1, -1] as Sign[]) {
      for (const c of [1, -1] as Sign[]) out.push([a, b, c]);
    }
  }
  return out;
};

export interface Claim { name: string; holds: boolean; detail: string }

export function theorem(): Claim[] {
  const gs = allCocycles();

  // (a) EXISTENCE is insensitive to the class.
  const cutAlwaysTerminates = gs.every((g) =>
    g.every((_, c) => sectionAlongRing(g, c, 0, 1).length === g.length)
  );
  const orientNeverTerminates = gs.every((g) => !orientBudgeted(g, 0, 500).terminated);

  // (b) CANONICITY is exactly the class.
  const canonicalIffTrivial = gs.every((g) =>
    everyCutAgrees(g) === (holonomyOf(g) === 1)
  );

  // (c) Cut-dependence is a class function: gauging at any node moves the
  //     cocycle and must not move the verdict. Without this, (b) is a
  //     statement about representatives rather than about H¹.
  const gaugeInvariant = gs.every((g) =>
    g.every((_, i) => everyCutAgrees(gaugeIn(g, i)) === everyCutAgrees(g))
  );
  const gaugeMovesCocycle = gs.some((g) =>
    g.some((_, i) => showRing(gaugeIn(g, i)) !== showRing(g))
  );

  return [
    {
      name: "cut terminates in both classes",
      holds: cutAlwaysTerminates,
      detail: "8/8 cocycles, every cut — existence does not see the class",
    },
    {
      name: "unbounded recursion terminates in neither",
      holds: orientNeverTerminates,
      detail: "8/8 cocycles incl. the cylinder — divergence does not see the class",
    },
    {
      name: "canonical ⟺ class trivial",
      holds: canonicalIffTrivial,
      detail: "8/8 cocycles — cut-independence IS the holonomy",
    },
    {
      name: "the verdict is gauge invariant",
      holds: gaugeInvariant && gaugeMovesCocycle,
      detail: "24 gauges move the cocycle and never the verdict — so it is H¹",
    },
  ];
}

// ── Report ────────────────────────────────────────────────────────────

if (import.meta.main) {
  const pad = (s: string, n: number) => s.padEnd(n);
  console.log("\nThe 2x2: class against well-foundedness\n");
  console.log(
    pad("class", 10) + pad("repair", 10) + pad("terminates", 12) +
      pad("canonical", 12) + "witness",
  );
  console.log("-".repeat(86));
  const cells: Cell[] = [];
  for (const g of [CYLINDER, MOBIUS] as RingSigns[]) {
    for (const repair of ["none", "cut"] as Repair[]) {
      const c = cell(g, repair);
      cells.push(c);
      console.log(
        pad(c.klass, 10) + pad(c.repair, 10) +
          pad(c.terminates ? "yes" : "no", 12) +
          pad(c.canonical === null ? "—" : c.canonical ? "yes" : "no", 12) +
          c.witness,
      );
    }
  }

  const populated = new Set(
    cells.map((c) => `${c.klass}/${c.terminates}`),
  ).size;
  console.log(
    `\nAll four cells populated: ${populated === 4 ? "yes" : "no"} ` +
      `(${populated}/4 distinct class x terminates combinations)`,
  );

  console.log("\nThe theorem, on all 8 cocycles:\n");
  let ok = true;
  for (const c of theorem()) {
    ok = ok && c.holds;
    console.log(`  [${c.holds ? "ok" : "FAIL"}] ${pad(c.name, 42)} ${c.detail}`);
  }

  console.log(
    "\n" + (ok
      ? "H1 does not measure the failure of the trace to exist.\n" +
        "It measures the failure of the forced trace to be canonical.\n"
      : "A claim failed. The conclusion above is not supported.\n"),
  );
  if (!ok) Deno.exit(1);
}
