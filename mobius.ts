// mobius.ts — the CLI. `./mobius <command>`.
//
// A note on honesty that runs through the whole file. Any command implemented
// by polling all three nodes and doing the arithmetic here HAS ELECTED A
// COORDINATOR, which is the ORIENT repair, and is marked [coordinator] in its
// output. The obstruction is only genuinely demonstrated by the commands where
// the arithmetic happens in the ring's backward maps and this program is one
// uninformed asker standing at node 0. Those are marked [in the ring].

import {
  antipode,
  classOfRing,
  closes,
  CYLINDER,
  deckImage,
  deckRatio,
  deckUniform,
  degreeOf,
  type Dir,
  everyCutAgrees,
  gaugeIn,
  holonomyOf,
  isRecord,
  MOBIUS,
  nerveOf,
  NODES,
  pathProductIn,
  PORT0,
  pullback,
  type RingId,
  type RingSigns,
  sectionAlongRing,
  sectionUpstairs,
  showRing,
  type Sign,
  stepIn,
  twistedSectionsOf,
} from "./cocycle.ts";
import { depthHeaders } from "./lib/wire.ts";

const B = (s: string) => `\x1b[1m${s}\x1b[0m`;
const D = (s: string) => `\x1b[2m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;

const USAGE = `
${B("mobius")} — three arcs of a cover, and the obstruction to gluing them.

  ${B("mobius signs")}         each node's edges, and whether neighbours agree
  ${B("mobius class")}         the product, the class, and how many global sections
  ${B("mobius nerve")}         the rank computation, and what it does NOT verify
  ${B("mobius holonomy")}      carry a value once round  [--from N] [--dir cw|ccw]
  ${B("mobius commute")}       the two routes from 0 to 1, compared
  ${B("mobius cut-compare")}   all three cuts, side by side
  ${B("mobius gauge")} --flip N   change one node's frame; edges move, class does not
  ${B("mobius twist")}         set the ring to the Mobius band  (+,+,-)
  ${B("mobius flat")}          set the ring to the cylinder     (+,+,+)

  ${B("mobius cover")} [n]      the n-fold cover: pull back, build the section,
                        check that it glues, then apply the deck transformation
  ${B("mobius deck")}           the deck comparison, in the ring

  ${B("mobius glue")}          try for a global section. Never returns.
    ${B("--cut A-B --root N")}   ORIENT.  Terminates. The answer depends on the cut.
    ${B("--fuel N")}             UNROLL.  F^n of bottom, which is bottom, for every n.
    ${B("--detect")}             WALK.    Terminates by seeing itself; reports the class.
    ${B("--deadline S")}         abandon the unbounded run after S seconds (default 15)

The ring must be up: ${B("./mobius-up.sh")}, or ${B("./mobius-up.sh --cover 2")} for six
arcs.  Trace: ${D("tail -f /tmp/mobius.log")}
`;

function flag(name: string, fallback?: string): string {
  const i = Deno.args.indexOf(`--${name}`);
  if (i >= 0 && Deno.args[i + 1]) return Deno.args[i + 1];
  if (fallback !== undefined) return fallback;
  console.error(`mobius: --${name} is required\n${USAGE}`);
  Deno.exit(2);
}
const has = (name: string) => Deno.args.includes(`--${name}`);

async function ask(node: RingId, prompt: unknown, signal?: AbortSignal): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`http://localhost:${PORT0 + node}`, {
      method: "POST",
      headers: depthHeaders(0),
      body: JSON.stringify(prompt),
      signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    console.error(`mobius: :${PORT0 + node} is not listening — run ./mobius-up.sh first`);
    Deno.exit(1);
  }
  const text = await res.text();
  if (!res.ok) {
    console.error(`mobius: ${text}`);
    Deno.exit(1);
  }
  return JSON.parse(text) as unknown;
}

const sign = (s: Sign) => (s === 1 ? G("+1") : R("-1"));
const num = (u: unknown): Sign => (u === -1 ? -1 : 1);
const row = (s: RingSigns) => s.map(sign).join("  ");

/** How many arcs are listening. The CLI could have been told on the command
 *  line, and a file in /tmp could have carried it over from `mobius-up.sh`,
 *  but both would let the CLI and the ring disagree about the space. Counting
 *  is a poll, so every command that needs it is a coordinator, which is
 *  already true of every command that reads the transition data. */
async function ringSize(): Promise<number> {
  let n = 0;
  for (let i = 0; i < NODES * 4; i++) {
    try {
      const res = await fetch(`http://localhost:${PORT0 + i}`, {
        method: "POST",
        headers: depthHeaders(0),
        body: JSON.stringify({ tag: "Local" }),
      });
      await res.text();
      n++;
    } catch {
      break;
    }
  }
  if (n === 0) {
    console.error(`mobius: :${PORT0} is not listening — run ./mobius-up.sh first`);
    Deno.exit(1);
  }
  if (n % NODES !== 0) {
    console.error(
      `mobius: ${n} arcs are listening, which is not a cover of a ${NODES}-arc base`,
    );
    Deno.exit(1);
  }
  return n;
}

/** Read the transition data back out of the ring. This is a poll of all three
 *  nodes, so every command that uses it is a coordinator. */
async function readSigns(): Promise<
  { g: RingSigns; ring: number; agree: boolean; rows: string[] }
> {
  const ring = await ringSize();
  const ids = Array.from({ length: ring }, (_, i) => i as RingId);
  const e = await Promise.all(
    ids.map(async (n) => {
      const r = await ask(n, { tag: "Edges" });
      if (!isRecord(r)) throw new Error("bad Edges reply");
      return { node: n, cw: num(r.cw), ccw: num(r.ccw) };
    }),
  );
  // Neighbours must agree on the edge they share. Disagreement is malformed
  // descent data, which is a DIFFERENT failure from well-formed data carrying a
  // non-zero class, and the demonstration is worthless if it cannot tell them
  // apart.
  const agree = e.every((x) => x.cw === e[(x.node + 1) % ring].ccw);
  const rows = e.map((x) =>
    `    node ${x.node}   cw ${sign(x.cw)}   ccw ${sign(x.ccw)}` +
    (x.cw === e[(x.node + 1) % ring].ccw ? "" : R("   ← disagrees with its neighbour"))
  );
  return { g: e.map((x) => x.cw), ring, agree, rows };
}

/** One value per node, which is what installing a section means. */
async function configure(g: RingSigns, values: RingSigns): Promise<void> {
  await Promise.all(
    values.map((value, n) => ask(n as RingId, { tag: "Configure", edges: g, value })),
  );
}

const broadcast = (g: RingSigns, value: Sign): Promise<void> =>
  configure(g, g.map(() => value));

const coordinator = D("[coordinator — this program did the arithmetic]");
const inRing = D("[in the ring — the backward maps did the arithmetic]");

// ── Commands ──────────────────────────────────────────────────────────

const cmd = Deno.args[0];

switch (cmd) {
  case "signs": {
    const { agree, rows } = await readSigns();
    console.log(`\n  ${B("TRANSITION DATA")}   ${coordinator}\n`);
    rows.forEach((r) => console.log(r));
    console.log(
      agree
        ? `\n    ${G("every neighbour agrees on the edge it shares")}`
        : `\n    ${R("the descent data is malformed — this is not a class, it is a mistake")}`,
    );
    console.log();
    break;
  }

  case "class": {
    const { g, ring, agree } = await readSigns();
    if (!agree) {
      console.error("mobius: the descent data is inconsistent; run `mobius signs`");
      Deno.exit(1);
    }
    const h = holonomyOf(g);
    const k = classOfRing(g);
    console.log(`\n  ${B("THE CLASS")}   ${coordinator}\n`);
    console.log(`    edges          ${showRing(g)}`);
    console.log(`    product        ${sign(h)}`);
    console.log(`    class          ${k === "mobius" ? Y("mobius band") : G("cylinder")}`);
    console.log(
      `    global sections of the twisted sheaf: ${B(String(twistedSectionsOf(g)))}`,
    );
    console.log(
      D(
        `\n    The qualifier is not decoration. The constant sheaf Z/2 always has\n` +
          `    its two constant sections. What is obstructed is the sheaf glued by\n` +
          `    these transitions.`,
      ),
    );
    if (ring > NODES) {
      console.log(
        Y(
          `\n    This ring is a ${degreeOf(ring)}-fold cover, and the product upstairs is +1 in\n` +
            `    BOTH classes, so this command cannot see the base class from here.\n` +
            `    That is p*alpha = 0 and not a triviality result. Run \`mobius cover\`.`,
        ),
      );
    }
    console.log();
    break;
  }

  case "nerve": {
    const n = nerveOf(await ringSize());
    console.log(`\n  ${B("THE NERVE")}\n`);
    console.log(`    arcs                    ${n.arcs}`);
    console.log(`    dim C0, C1, C2          ${n.c0}, ${n.c1}, ${n.c2}`);
    console.log(`    Z1 = C1                 rank ${n.z1}   (d1 lands in 0)`);
    console.log(`    B1 = im d0              rank ${n.b1}   (ker d0 = the constants)`);
    console.log(`    H1 = Z1/B1              ${B(n.h1)}`);
    console.log(
      Y(
        `\n    The triple overlap is empty, so the cocycle condition is VACUOUS.\n` +
          `    This demonstrates monodromy. It does not exercise coherence.`,
      ),
    );
    console.log();
    break;
  }

  case "holonomy": {
    const ring = await ringSize();
    const from = Number(flag("from", "0")) as RingId;
    const dir = flag("dir", "cw") as Dir;
    const before = await ask(from, { tag: "Ask", dir, fuel: 0 });
    const after = await ask(from, { tag: "Ask", dir, fuel: ring });
    if (!isRecord(before) || !isRecord(after)) Deno.exit(1);
    const b = num(before.value), a = num(after.value);
    console.log(`\n  ${B("HOLONOMY")}   ${inRing}\n`);
    console.log(`    node ${from} says its own value is        ${sign(b)}`);
    console.log(`    carried once round it comes back    ${sign(a)}`);
    console.log(`    path                                ${JSON.stringify(after.path)}`);
    console.log(
      a === b
        ? `\n    ${G("unchanged. The loop does nothing and the data glue.")}`
        : `\n    ${Y("changed. Every pair agrees and there is no global section.")}`,
    );
    console.log();
    break;
  }

  case "commute": {
    const { g, ring } = await readSigns();
    const short = pathProductIn(g, 0, "cw", 1);
    const long = pathProductIn(g, 0, "ccw", ring - 1);
    console.log(`\n  ${B("PATH INDEPENDENCE")}   ${coordinator}\n`);
    console.log(`    0 → 1 direct                ${sign(short)}`);
    console.log(`    0 → … → 1 the long way      ${sign(long)}`);
    console.log(
      short === long
        ? `\n    ${G("the two routes agree")}`
        : `\n    ${Y("the two routes disagree, and the disagreement is the class")}`,
    );
    console.log(
      D(
        `\n    Not "the operations commute". Z/2 is abelian, so order never mattered\n` +
          `    in either class. What separates them is monodromy.`,
      ),
    );
    console.log();
    break;
  }

  case "cut-compare": {
    const { g, ring } = await readSigns();
    const names = g.map((_, c) => `e${c}${(c + 1) % ring}`);
    console.log(`\n  ${B("EVERY CUT, SAME ROOT, SAME ROOT VALUE")}   ${coordinator}\n`);
    const secs = g.map((_, c) => sectionAlongRing(g, c, 0, 1));
    secs.forEach((s, c) => console.log(`    cut ${names[c]}   section  ${row(s)}`));
    const allSame = secs.every((s) => s.every((v, i) => v === secs[0][i]));
    console.log(
      allSame
        ? `\n    ${G("all three cuts agree. The section does not depend on the cut.")}`
        : `\n    ${Y("the cuts disagree, and any two differ exactly by the class.")}`,
    );
    console.log(
      D(
        `\n    Changing the ROOT only gauges the section globally and is not\n` +
          `    observable. Only changing the CUT is.`,
      ),
    );
    console.log();
    break;
  }

  case "gauge": {
    const i = Number(flag("flip")) as RingId;
    const { g } = await readSigns();
    const h = gaugeIn(g, i);
    await broadcast(h, 1);
    console.log(`\n  ${B("CHANGE OF FRAME AT NODE " + i)}   ${coordinator}\n`);
    console.log(`    before   ${showRing(g)}   product ${sign(holonomyOf(g))}`);
    console.log(`    after    ${showRing(h)}   product ${sign(holonomyOf(h))}`);
    console.log(
      `\n    ${G("two edges moved and the class did not.")} ` +
        D("That is the modulo-coboundaries half of H1,"),
    );
    console.log(D("    and it is where \"nobody behaved badly\" is earned rather than asserted."));
    console.log();
    break;
  }

  case "twist":
  case "flat": {
    const ring = await ringSize();
    const base = cmd === "twist" ? MOBIUS : CYLINDER;
    const g = pullback(base, degreeOf(ring));
    await broadcast(g, 1);
    console.log(
      `  ring set to ${showRing(g)} — base class ${classOfRing(base)}` +
        (ring > NODES
          ? `, product upstairs ${holonomyOf(g) === 1 ? "+1" : "-1"}`
          : ""),
    );
    break;
  }

  // ── The double cover ────────────────────────────────────────────────
  // The order of this output is not cosmetic. A reader who sees "it glues"
  // and stops has learned the wrong thing, so the closure check is stated
  // together with the fact that it holds in both classes, and the deck
  // transformation comes after.
  case "cover": {
    const { g, ring, agree } = await readSigns();
    if (!agree) {
      console.error("mobius: the descent data is inconsistent; run `mobius signs`");
      Deno.exit(1);
    }
    const degree = degreeOf(ring);
    const wanted = Deno.args[1] === undefined ? degree : Number(Deno.args[1]);
    if (wanted !== degree) {
      console.error(
        `mobius: ${ring} arcs are listening, which is the ${degree}-fold cover.\n` +
          `        For the ${wanted}-fold cover: ./mobius-up.sh --cover ${wanted}`,
      );
      Deno.exit(1);
    }

    // The base, recovered from upstairs. The pullback repeats the base data, so
    // the first three edges ARE the base and there is nothing to reconstruct.
    const base = g.slice(0, NODES);
    const s = sectionUpstairs(g, 1);

    console.log(`\n  ${B(`THE ${degree}-FOLD COVER`)}   ${coordinator}\n`);
    console.log(`    base            ${showRing(base)}     product ${sign(holonomyOf(base))}` +
      `   ${classOfRing(base) === "mobius" ? Y("mobius band") : G("cylinder")}`);
    console.log(`    degree          ${degree}`);
    console.log(`    pulled back     ${showRing(g)}   ${D("eps_i = g_(i mod 3)")}`);

    // Installed, not just printed. `mobius deck` compares the two sheets of
    // THIS section, and if the nodes were still holding a constant the
    // comparison would collapse back into the holonomy of the base and prove
    // nothing new. One value per node is what a section is.
    await configure(g, s);

    console.log(`\n    ${B("the section upstairs")}, from node 0 with s_0 = +1\n`);
    console.log(`      s         ${row(s)}   ${D("installed, one value per node")}`);
    console.log(
      `\n      closure   eps_${ring - 1} . s_${ring - 1} = ${sign(
        (g[ring - 1] * s[ring - 1]) as Sign,
      )} = s_0` +
        (closes(g, s) ? `   ${G("it glues")}` : `   ${R("it does not glue")}`),
    );
    console.log(
      `      cuts      ${
        everyCutAgrees(g)
          ? G("every cut gives the same section")
          : Y("the cuts disagree")
      }`,
    );
    console.log(`      product   ${sign(holonomyOf(g))}   upstairs, over all ${ring} edges`);
    console.log(
      Y(
        `\n    ${B("+1 IN BOTH CLASSES.")} Six hops trivialise the twist on the cylinder\n` +
          `    too, so nothing above this line separates them, and a naive\n` +
          `    demonstration that stopped here would print the same thing either\n` +
          `    way. This is p*alpha = 0 — alpha is m |-> m mod 2 and the cover's\n` +
          `    pi_1 is 2Z — and it is the reason a section exists at all, not a\n` +
          `    result about the twist.`,
      ),
    );

    const img = deckImage(s);
    const ratio = deckRatio(s);
    console.log(
      `\n    ${B("the deck transformation")}, sigma(i) = i + ${NODES} mod ${ring}\n`,
    );
    console.log(`      sigma*s   ${row(img)}`);
    console.log(
      `      ratio     ${sign(ratio)}` +
        (deckUniform(s) ? `   ${D("the same at every node")}` : `   ${R("not uniform")}`),
    );
    console.log(
      ratio === 1
        ? `\n    ${G("sigma*s = +s.")} The two sheets agree, so the section descends to\n` +
          `    the base, which is where it existed already.`
        : `\n    ${Y("sigma*s = -s.")} A section exists upstairs and it is NOT\n` +
          `    deck-invariant, so the federation is consistent only by being two\n` +
          `    federations that disagree with each other. That is the price, and\n` +
          `    it is a precise statement of what a centre costs.`,
    );
    console.log(
      D(
        `\n    The obstruction has not gone away. It has been pulled back to a\n` +
          `    cover where it is zero, and downstairs it is exactly where it was.\n` +
          `    In seven-federations.pdf this is the Ridda outcome: the root\n` +
          `    transferred, and there ended up being two answers, each internally\n` +
          `    coherent.\n\n` +
          `    And this command is a coordinator. It polled every arc and built\n` +
          `    the section here, which is legitimate only because upstairs there\n` +
          `    is nothing to obstruct it: every cut agrees. \`mobius deck\` does\n` +
          `    the comparison in the ring.`,
      ),
    );
    console.log();
    break;
  }

  case "deck": {
    const ring = await ringSize();
    const from = Number(flag("from", "0")) as RingId;
    const dir = flag("dir", "cw") as Dir;
    const r = await ask(from, { tag: "Deck", dir, fuel: NODES });
    if (!isRecord(r)) Deno.exit(1);
    const transported = num(r.transported);
    const theirs = num(r.theirs);
    const ratio = (transported * theirs) as Sign;
    const far = Number(r.antipode);

    console.log(`\n  ${B("THE DECK TRANSFORMATION")}   ${inRing}\n`);
    console.log(
      `    node ${from} walks ${NODES} hops ${dir} and arrives at node ${far}` +
        (far === from
          ? Y(`, which is itself`)
          : `, the other\n    sheet over the same arc of the base`),
    );
    console.log(`\n    transported   ${sign(transported)}   ${D("eps at every frame, the same backward map as Ask")}`);
    console.log(`    theirs        ${sign(theirs)}   ${D("relayed untouched; the covering map identifies the frames")}`);
    console.log(`    ratio         ${sign(ratio)}   ${D("= the product over the BASE")}`);
    console.log(
      r.agree === true
        ? `\n    ${G("the two backward maps agree.")} The section is deck-invariant and\n` +
          `    descends to the base.`
        : `\n    ${Y("the two backward maps disagree, and what they disagree by is the")}\n` +
          `    ${Y("class of the base.")} Neither map is wrong.`,
    );
    if (ring === NODES) {
      console.log(
        Y(
          `\n    This ring is the base, so the deck group is trivial, the antipode\n` +
            `    of a node is itself, and the comparison has degenerated to the\n` +
            `    holonomy — there is no section here to compare two sheets of.\n` +
            `    For the real thing: ./mobius-up.sh --cover 2 && ./mobius cover 2`,
        ),
      );
    } else {
      console.log(
        D(
          `\n    Transport round ${NODES} hops is exactly how \`mobius cover\` built the\n` +
            `    section, so \`transported\` agrees with the far node's value by\n` +
            `    construction, in either class. \`theirs\` arrives under the identity\n` +
            `    instead, because the covering map needs no transition function to\n` +
            `    compare two sheets over one arc, and the two answers differ by the\n` +
            `    product over the base. What the ring computed is sigma*s against s,\n` +
            `    on a cover where a section genuinely exists.`,
        ),
      );
    }
    console.log();
    break;
  }

  case "glue": {
    // ORIENT — the CLI cuts an edge and propagates. No node knows about the
    // cut, which is the point: cutting is something done TO a federation from
    // outside it.
    if (has("cut")) {
      const { g, ring } = await readSigns();
      const cutArg = flag("cut");
      // Edge c joins node c to node c+1, so a cut is named by its endpoints and
      // the pair must be adjacent in the ring. On a cover there are more edges
      // to name and the arithmetic is the same.
      const ends = cutArg.split("-").map(Number);
      const cut = ends.length === 2 && ends.every((v) => Number.isInteger(v)) &&
          stepIn(ring, ends[0], "cw") === ends[1]
        ? ends[0]
        : undefined;
      if (cut === undefined) {
        console.error(
          `mobius: --cut wants two adjacent nodes of a ${ring}-ring, ` +
            `such as 0-1 or ${ring - 1}-0`,
        );
        Deno.exit(2);
      }
      const root = Number(flag("root", "0")) as RingId;
      const s = sectionAlongRing(g, cut, root, 1);
      console.log(`\n  ${B("ORIENT")}   ${coordinator}\n`);
      console.log(`    cut ${cutArg}, rooted at ${root}`);
      console.log(`    section   ${row(s)}`);
      console.log(
        `\n    ${G("terminates.")} ` +
          D("The ring minus an edge is a path, and a path has no monodromy."),
      );
      console.log(D("    Compare `mobius cut-compare`: the answer depends on where you cut."));
      console.log();
      break;
    }

    // UNROLL — bounded, and bounded at every n.
    if (has("fuel")) {
      const fuel = Number(flag("fuel"));
      const r = await ask(0, { tag: "Unroll", dir: "cw", fuel });
      if (!isRecord(r)) Deno.exit(1);
      console.log(`\n  ${B("UNROLL")}   ${inRing}\n`);
      console.log(`    fuel ${fuel}   →   ${B(String(r.tag))}`);
      console.log(`    reached   ${JSON.stringify(r.path)}`);
      console.log(
        D(
          `\n    F^n of bottom is bottom, for every n. The difference from Ask is\n` +
            `    entirely in the response type, which is what makes it a repair\n` +
            `    rather than an answer.`,
        ),
      );
      console.log();
      break;
    }

    // WALK — terminates by recognising itself, and what it reports is the class.
    if (has("detect")) {
      const r = await ask(0, { tag: "Walk", dir: "cw", visited: [] });
      if (!isRecord(r)) Deno.exit(1);
      console.log(`\n  ${B("WALK")}   ${inRing}\n`);
      console.log(`    loop        ${JSON.stringify(r.loop)}`);
      console.log(`    holonomy    ${sign(num(r.holonomy))}`);
      console.log(
        D(
          `\n    Detecting the cycle and computing H1 are the same act. The node\n` +
            `    that sees itself returns the empty product, and every frame on the\n` +
            `    way back multiplies by its own edge.`,
        ),
      );
      console.log();
      break;
    }

    // The unbounded one.
    const seconds = Number(flag("deadline", "15"));
    console.log(`\n  ${B("GLUE")}   ${inRing}\n`);
    console.log("    Asking node 0 for a global section, with no cut, no fuel and");
    console.log("    no memory of where it has been.");
    console.log(Y(`\n    This will not return. Four things would stop it:`));
    console.log(D("      --cut 2-0 --root 0    elect a coordinator"));
    console.log(D("      --fuel 6              take an approximation"));
    console.log(D("      --detect              remember where you have been"));
    console.log(D("      ./mobius-down.sh      stop the ring"));
    console.log(D(`\n    Abandoning after ${seconds}s. Watch: tail -f /tmp/mobius.log\n`));

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), seconds * 1000);
    try {
      await ask(0, { tag: "Orient", dir: "cw" }, ctl.signal);
      console.log(R("    it returned, which should be impossible"));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        console.log(`    ${Y("abandoned after " + seconds + "s.")}`);
        console.log(
          D(
            `\n    Note what did NOT happen. Nothing deadlocked. Nothing was blocked\n` +
              `    on a peer. The response type is inhabited and total; no total\n` +
              `    program inhabits it. Containers type the interface and say nothing\n` +
              `    about the well-foundedness of the composite.\n\n` +
              `    And the ring is still turning. Cancelling this request did not\n` +
              `    cancel the hops beneath it. ./mobius-down.sh is what stops it.`,
          ),
        );
      } else throw e;
    } finally {
      clearTimeout(timer);
    }
    console.log();
    break;
  }

  default:
    console.log(USAGE);
    Deno.exit(cmd === undefined ? 0 : 2);
}
