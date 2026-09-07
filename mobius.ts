// mobius.ts — the CLI. `./mobius <command>`.
//
// A note on honesty that runs through the whole file. Any command implemented
// by polling all three nodes and doing the arithmetic here HAS ELECTED A
// COORDINATOR, which is the ORIENT repair, and is marked [coordinator] in its
// output. The obstruction is only genuinely demonstrated by the commands where
// the arithmetic happens in the ring's backward maps and this program is one
// uninformed asker standing at node 0. Those are marked [in the ring].

import {
  type Cocycle,
  classOf,
  type Dir,
  gauge,
  holonomy,
  isRecord,
  type NodeId,
  nerve,
  pathProduct,
  PORT0,
  sectionAlong,
  showSigns,
  type Sign,
  twistedSections,
  CYLINDER,
  MOBIUS,
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

  ${B("mobius glue")}          try for a global section. Never returns.
    ${B("--cut A-B --root N")}   ORIENT.  Terminates. The answer depends on the cut.
    ${B("--fuel N")}             UNROLL.  F^n of bottom, which is bottom, for every n.
    ${B("--detect")}             WALK.    Terminates by seeing itself; reports the class.
    ${B("--deadline S")}         abandon the unbounded run after S seconds (default 15)

The ring must be up: ${B("./mobius-up.sh")}.  Trace: ${D("tail -f /tmp/mobius.log")}
`;

function flag(name: string, fallback?: string): string {
  const i = Deno.args.indexOf(`--${name}`);
  if (i >= 0 && Deno.args[i + 1]) return Deno.args[i + 1];
  if (fallback !== undefined) return fallback;
  console.error(`mobius: --${name} is required\n${USAGE}`);
  Deno.exit(2);
}
const has = (name: string) => Deno.args.includes(`--${name}`);

async function ask(node: NodeId, prompt: unknown, signal?: AbortSignal): Promise<unknown> {
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

/** Read the transition data back out of the ring. This is a poll of all three
 *  nodes, so every command that uses it is a coordinator. */
async function readSigns(): Promise<{ g: Cocycle; agree: boolean; rows: string[] }> {
  const e = await Promise.all(
    ([0, 1, 2] as NodeId[]).map(async (n) => {
      const r = await ask(n, { tag: "Edges" });
      if (!isRecord(r)) throw new Error("bad Edges reply");
      return { node: n, cw: num(r.cw), ccw: num(r.ccw) };
    }),
  );
  // Neighbours must agree on the edge they share. Disagreement is malformed
  // descent data, which is a DIFFERENT failure from well-formed data carrying a
  // non-zero class, and the demonstration is worthless if it cannot tell them
  // apart.
  const agree = e.every((x) => x.cw === e[(x.node + 1) % 3].ccw);
  const rows = e.map((x) =>
    `    node ${x.node}   cw ${sign(x.cw)}   ccw ${sign(x.ccw)}` +
    (x.cw === e[(x.node + 1) % 3].ccw ? "" : R("   ← disagrees with its neighbour"))
  );
  return { g: [e[0].cw, e[1].cw, e[2].cw] as Cocycle, agree, rows };
}

async function broadcast(g: Cocycle, value: Sign): Promise<void> {
  await Promise.all(
    ([0, 1, 2] as NodeId[]).map((n) => ask(n, { tag: "Configure", edges: g, value })),
  );
}

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
    const { g, agree } = await readSigns();
    if (!agree) {
      console.error("mobius: the descent data is inconsistent; run `mobius signs`");
      Deno.exit(1);
    }
    const h = holonomy(g);
    const k = classOf(g);
    console.log(`\n  ${B("THE CLASS")}   ${coordinator}\n`);
    console.log(`    edges          ${showSigns(g)}`);
    console.log(`    product        ${sign(h)}`);
    console.log(`    class          ${k === "mobius" ? Y("mobius band") : G("cylinder")}`);
    console.log(
      `    global sections of the twisted sheaf: ${B(String(twistedSections(g)))}`,
    );
    console.log(
      D(
        `\n    The qualifier is not decoration. The constant sheaf Z/2 always has\n` +
          `    its two constant sections. What is obstructed is the sheaf glued by\n` +
          `    these transitions.`,
      ),
    );
    console.log();
    break;
  }

  case "nerve": {
    const n = nerve();
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
    const from = Number(flag("from", "0")) as NodeId;
    const dir = flag("dir", "cw") as Dir;
    const before = await ask(from, { tag: "Ask", dir, fuel: 0 });
    const after = await ask(from, { tag: "Ask", dir, fuel: 3 });
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
    const { g } = await readSigns();
    const short = pathProduct(g, 0, "cw", 1);
    const long = pathProduct(g, 0, "ccw", 2);
    console.log(`\n  ${B("PATH INDEPENDENCE")}   ${coordinator}\n`);
    console.log(`    0 → 1 direct                ${sign(short)}`);
    console.log(`    0 → 2 → 1 the long way      ${sign(long)}`);
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
    const { g } = await readSigns();
    const names = ["e01", "e12", "e20"] as const;
    console.log(`\n  ${B("EVERY CUT, SAME ROOT, SAME ROOT VALUE")}   ${coordinator}\n`);
    const secs = ([0, 1, 2] as const).map((c) => sectionAlong(g, c, 0, 1));
    secs.forEach((s, c) =>
      console.log(`    cut ${names[c]}   section  ${s.map(sign).join("  ")}`)
    );
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
    const i = Number(flag("flip")) as NodeId;
    const { g } = await readSigns();
    const h = gauge(g, i);
    await broadcast(h, 1);
    console.log(`\n  ${B("CHANGE OF FRAME AT NODE " + i)}   ${coordinator}\n`);
    console.log(`    before   ${showSigns(g)}   product ${sign(holonomy(g))}`);
    console.log(`    after    ${showSigns(h)}   product ${sign(holonomy(h))}`);
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
    const g = cmd === "twist" ? MOBIUS : CYLINDER;
    await broadcast(g, 1);
    console.log(`  ring set to ${showSigns(g)} — ${classOf(g)}`);
    break;
  }

  case "glue": {
    // ORIENT — the CLI cuts an edge and propagates. No node knows about the
    // cut, which is the point: cutting is something done TO a federation from
    // outside it.
    if (has("cut")) {
      const { g } = await readSigns();
      const cutArg = flag("cut");
      const map: Record<string, 0 | 1 | 2> = { "0-1": 0, "1-2": 1, "2-0": 2 };
      const cut = map[cutArg];
      if (cut === undefined) {
        console.error("mobius: --cut wants 0-1, 1-2 or 2-0");
        Deno.exit(2);
      }
      const root = Number(flag("root", "0")) as NodeId;
      const s = sectionAlong(g, cut, root, 1);
      console.log(`\n  ${B("ORIENT")}   ${coordinator}\n`);
      console.log(`    cut ${cutArg}, rooted at ${root}`);
      console.log(`    section   ${s.map(sign).join("  ")}`);
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
