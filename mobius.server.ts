// mobius.server.ts (:8811, :8812, :8813) — one arc of the cover.
//
// One file, three servers, selected by MOBIUS_NODE. A cover is three objects of
// the SAME container, and three near-identical files would say the opposite.
//
// Each node is a container: it accepts the prompts below and answers them. Each
// node is also a morphism: it answers a delegating prompt by prompting its
// neighbour and applying its own edge transition to the reply. The sign is
// applied on the way back, in `f`, and nowhere else. A prompt carries no value
// — it says "tell me your local value" — because a value travelling outward
// would put the transition function in `u`, which is the wrong map.

import {
  type Ack,
  type Bounded,
  type Carried,
  type DeckReport,
  type Dir,
  type EdgeReport,
  epsilonIn,
  isDir,
  isRecord,
  isRingId,
  isRingSigns,
  isSign,
  type LocalReport,
  type LoopClosed,
  type MobPrompt,
  MOBIUS,
  NODES,
  parseRing,
  PORT0,
  pullback,
  type RingId,
  type RingSigns,
  type Sign,
  stepIn,
} from "./cocycle.ts";
import { delegate, serveContainer } from "./lib/wire.ts";

export interface MobResponses {
  Local: LocalReport;
  Edges: EdgeReport;
  Configure: Ack;
  Ask: Carried;
  Unroll: Bounded;
  Orient: Carried;
  Walk: LoopClosed;
  Deck: DeckReport;
}
type Reply<K extends MobPrompt["tag"]> = MobResponses[K];

// ── This node ─────────────────────────────────────────────────────────
// Every server reads ONE variable, so they cannot disagree about the descent
// data by construction. Disagreement is still possible after a `Configure`
// broadcast partly fails, which is why `mobius signs` exists: bad transition
// data and a non-zero class are different failures and the demo is worthless
// if it cannot tell them apart.
//
// MOBIUS_RING is how long the ring is: three for the base, six for the double
// cover. The node does not know it is on a cover and does not need to. It hops
// to its neighbour modulo the ring it is in, and that is the whole difference.

const me: RingId = Number(Deno.env.get("MOBIUS_NODE") ?? "0");
const RING = Number(Deno.env.get("MOBIUS_RING") ?? String(NODES));
const PORT = PORT0 + me;

let signs: RingSigns = parseRing(Deno.env.get("MOBIUS_SIGNS") ?? "+,+,-") ??
  pullback(MOBIUS, RING / NODES);
let value: Sign = (Number(Deno.env.get("MOBIUS_VALUE") ?? "1") === -1 ? -1 : 1);

// A ring of six carrying three signs is not a class, it is a mistake, and it
// would show up as a wrong answer rather than a failure if it were allowed
// through. Refuse to start instead.
if (signs.length !== RING) {
  console.error(
    `node ${me}: MOBIUS_RING is ${RING} but MOBIUS_SIGNS has ${signs.length} entries`,
  );
  Deno.exit(2);
}

const eps = (dir: Dir): Sign => epsilonIn(signs, me, dir);
const neighbour = (dir: Dir): RingId => stepIn(RING, me, dir);

/** Every delegating fibre makes the same hop: the same prompt, to the
 *  neighbour in `dir`, one unit less of whatever it is counting. Only the
 *  backward map differs between them, and that is the finding — these fibres
 *  are one construction distinguished by `f`, not five programs. */
const hop = (prompt: MobPrompt, dir: Dir, depth: number): Promise<unknown> =>
  delegate(PORT0 + neighbour(dir), prompt, depth);

// ── The handlers ──────────────────────────────────────────────────────

type Handlers = {
  [K in MobPrompt["tag"]]: (
    p: Extract<MobPrompt, { tag: K }>,
    depth: number,
  ) => Promise<Reply<K>>;
};

const handlers: Handlers = {
  Local: (_p) => Promise.resolve({ node: me, value }),

  Edges: (_p) =>
    Promise.resolve({ node: me, cw: eps("cw"), ccw: eps("ccw") }),

  Configure: (p) => {
    signs = p.edges;
    value = p.value;
    return Promise.resolve({ ok: true as const });
  },

  // Transport. At fuel zero a node answers with its own value, in its own
  // frame. Above zero it asks its neighbour and re-expresses the reply.
  Ask: async (p, depth) => {
    if (p.fuel <= 0) return { value, hops: 0, path: [me] };
    const raw = await hop({ tag: "Ask", dir: p.dir, fuel: p.fuel - 1 }, p.dir, depth);
    const r = decodeCarried(raw);
    // ── f, and only f ──
    return { value: (eps(p.dir) * r.value) as Sign, hops: r.hops + 1, path: [me, ...r.path] };
  },

  // F^n of bottom, honestly. At fuel zero there is no answer, and there is no
  // n for which there is one, because the recursion has no base case to reach.
  // The difference from `Ask` is entirely in the response type.
  Unroll: async (p, depth) => {
    if (p.fuel <= 0) return { tag: "Exhausted", path: [me] };
    const raw = await hop({ tag: "Unroll", dir: p.dir, fuel: p.fuel - 1 }, p.dir, depth);
    const r = decodeBounded(raw);
    if (r.tag === "Exhausted") return { tag: "Exhausted", path: [me, ...r.path] };
    return {
      tag: "Carried",
      value: (eps(p.dir) * r.value) as Sign,
      path: [me, ...r.path],
    };
  },

  // The unbounded one. No base case, no fuel, no visited list. This does not
  // deadlock: nothing is blocked and nothing waits on a peer's reply to its own
  // reply. It is infinite regress. The response type is inhabited and total; no
  // total program inhabits it; and TypeScript, serveContainer and delegate all
  // accept it without complaint. Containers type the interface and say nothing
  // about the well-foundedness of the composite.
  Orient: async (p, depth) => {
    const raw = await hop({ tag: "Orient", dir: p.dir }, p.dir, depth);
    const r = decodeCarried(raw);
    return { value: (eps(p.dir) * r.value) as Sign, hops: r.hops + 1, path: [me, ...r.path] };
  },

  // Cycle detection, and note what it reports. The node that sees itself
  // returns the empty product; every frame on the way back multiplies by its
  // own edge. So detecting the cycle and computing H1 are the same act, and the
  // holonomy is accumulated entirely in the backward maps.
  Walk: async (p, depth) => {
    if (p.visited.includes(me)) return { loop: [...p.visited, me], holonomy: 1 };
    const raw = await hop(
      { tag: "Walk", dir: p.dir, visited: [...p.visited, me] },
      p.dir,
      depth,
    );
    const r = decodeClosed(raw);
    return { loop: r.loop, holonomy: (eps(p.dir) * r.holonomy) as Sign };
  },

  // The deck transformation. This is `Ask` again — the same hop, the same
  // recursion, the same accumulation of eps on the way back — carrying one
  // extra value under a SECOND backward map, the identity.
  //
  // The walk is three hops, the size of the base, so the node it reaches is
  // the other sheet over the same arc. `transported` comes back multiplied by
  // eps at every frame, which is exactly how the section was built, so it
  // always agrees with the far node's value and always would, in both classes.
  // `theirs` comes back untouched. The covering map identifies the fibre over
  // arc i with the fibre over arc i + 3, and that identification is the
  // identity, so the far node's value needs no transport to be compared with
  // this one. The nodes in between relay it without reading it, which they
  // must, because they lie over a different arc and it is not in their frame.
  //
  // Two honest backward maps along one walk, disagreeing by the class of the
  // base. That the intermediate `agree` fields compare partial products is
  // noise; the only one that means anything is the outermost, where the fuel
  // was three.
  Deck: async (p, depth) => {
    if (p.fuel <= 0) {
      return { node: me, antipode: me, transported: value, theirs: value, agree: true };
    }
    const raw = await hop({ tag: "Deck", dir: p.dir, fuel: p.fuel - 1 }, p.dir, depth);
    const r = decodeDeck(raw);
    // ── f, twice: eps for the transport, the identity for the covering map ──
    const transported = (eps(p.dir) * r.transported) as Sign;
    return {
      node: me,
      antipode: r.antipode,
      transported,
      theirs: r.theirs,
      agree: transported === r.theirs,
    };
  },
};

function answer<P extends MobPrompt>(p: P, depth: number): Promise<Reply<P["tag"]>> {
  const h = handlers[p.tag] as (q: MobPrompt, d: number) => Promise<Reply<P["tag"]>>;
  return h(p, depth);
}

// ── Decoding what comes back off the wire ─────────────────────────────
// The only runtime validation boundary. A reply that does not validate is a
// thrown error, which serveContainer turns into a `↑ FAILED` and propagates.

const bad = (what: string, u: unknown): never => {
  throw new Error(`node ${me}: neighbour returned a bad ${what}: ${JSON.stringify(u)}`);
};

function decodeCarried(u: unknown): Carried {
  if (isRecord(u) && isSign(u.value) && typeof u.hops === "number" && Array.isArray(u.path)) {
    return { value: u.value, hops: u.hops, path: u.path as RingId[] };
  }
  return bad("Carried", u);
}

function decodeBounded(u: unknown): Bounded {
  if (isRecord(u) && Array.isArray(u.path)) {
    if (u.tag === "Exhausted") return { tag: "Exhausted", path: u.path as RingId[] };
    if (u.tag === "Carried" && isSign(u.value)) {
      return { tag: "Carried", value: u.value, path: u.path as RingId[] };
    }
  }
  return bad("Bounded", u);
}

function decodeClosed(u: unknown): LoopClosed {
  if (isRecord(u) && isSign(u.holonomy) && Array.isArray(u.loop)) {
    return { loop: u.loop as RingId[], holonomy: u.holonomy };
  }
  return bad("LoopClosed", u);
}

function decodeDeck(u: unknown): DeckReport {
  if (
    isRecord(u) && isRingId(u.node, RING) && isRingId(u.antipode, RING) &&
    isSign(u.transported) && isSign(u.theirs) && typeof u.agree === "boolean"
  ) {
    return {
      node: u.node,
      antipode: u.antipode,
      transported: u.transported,
      theirs: u.theirs,
      agree: u.agree,
    };
  }
  return bad("DeckReport", u);
}

// ── The validator ─────────────────────────────────────────────────────

export function parseMob(u: unknown): MobPrompt | null {
  if (!isRecord(u) || typeof u.tag !== "string") return null;
  switch (u.tag) {
    case "Local":
      return { tag: "Local" };
    case "Edges":
      return { tag: "Edges" };
    case "Configure":
      return isRingSigns(u.edges, RING) && isSign(u.value)
        ? { tag: "Configure", edges: u.edges, value: u.value }
        : null;
    case "Ask":
      return isDir(u.dir) && typeof u.fuel === "number"
        ? { tag: "Ask", dir: u.dir, fuel: u.fuel }
        : null;
    case "Unroll":
      return isDir(u.dir) && typeof u.fuel === "number"
        ? { tag: "Unroll", dir: u.dir, fuel: u.fuel }
        : null;
    case "Orient":
      return isDir(u.dir) ? { tag: "Orient", dir: u.dir } : null;
    case "Walk":
      return isDir(u.dir) && Array.isArray(u.visited) &&
          u.visited.every((v) => isRingId(v, RING))
        ? { tag: "Walk", dir: u.dir, visited: u.visited as RingId[] }
        : null;
    case "Deck":
      return isDir(u.dir) && typeof u.fuel === "number"
        ? { tag: "Deck", dir: u.dir, fuel: u.fuel }
        : null;
    default:
      return null;
  }
}

if (import.meta.main) {
  serveContainer({
    name: `node${me}`,
    port: PORT,
    parse: parseMob,
    answer,
  });
}
