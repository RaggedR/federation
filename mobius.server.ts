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
  type Cocycle,
  type Dir,
  type EdgeReport,
  epsilon,
  isCocycle,
  isDir,
  isNodeId,
  isRecord,
  isSign,
  type LocalReport,
  type LoopClosed,
  type MobPrompt,
  type NodeId,
  parseSigns,
  PORT0,
  type Sign,
  step,
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
}
type Reply<K extends MobPrompt["tag"]> = MobResponses[K];

// ── This node ─────────────────────────────────────────────────────────
// The three servers read ONE variable, so they cannot disagree about the
// descent data by construction. Disagreement is still possible after a
// `Configure` broadcast partly fails, which is why `mobius signs` exists: bad
// transition data and a non-zero class are different failures and the demo is
// worthless if it cannot tell them apart.

const me = Number(Deno.env.get("MOBIUS_NODE") ?? "0") as NodeId;
const PORT = PORT0 + me;

let signs: Cocycle = parseSigns(Deno.env.get("MOBIUS_SIGNS") ?? "+,+,-") ?? [1, 1, -1];
let value: Sign = (Number(Deno.env.get("MOBIUS_VALUE") ?? "1") === -1 ? -1 : 1);

const eps = (dir: Dir): Sign => epsilon(signs, me, dir);
const neighbour = (dir: Dir): NodeId => step(me, dir);

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
    const raw = await delegate(
      PORT0 + neighbour(p.dir),
      { tag: "Ask", dir: p.dir, fuel: p.fuel - 1 },
      depth,
    );
    const r = decodeCarried(raw);
    // ── f, and only f ──
    return { value: (eps(p.dir) * r.value) as Sign, hops: r.hops + 1, path: [me, ...r.path] };
  },

  // F^n of bottom, honestly. At fuel zero there is no answer, and there is no
  // n for which there is one, because the recursion has no base case to reach.
  // The difference from `Ask` is entirely in the response type.
  Unroll: async (p, depth) => {
    if (p.fuel <= 0) return { tag: "Exhausted", path: [me] };
    const raw = await delegate(
      PORT0 + neighbour(p.dir),
      { tag: "Unroll", dir: p.dir, fuel: p.fuel - 1 },
      depth,
    );
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
    const raw = await delegate(
      PORT0 + neighbour(p.dir),
      { tag: "Orient", dir: p.dir },
      depth,
    );
    const r = decodeCarried(raw);
    return { value: (eps(p.dir) * r.value) as Sign, hops: r.hops + 1, path: [me, ...r.path] };
  },

  // Cycle detection, and note what it reports. The node that sees itself
  // returns the empty product; every frame on the way back multiplies by its
  // own edge. So detecting the cycle and computing H1 are the same act, and the
  // holonomy is accumulated entirely in the backward maps.
  Walk: async (p, depth) => {
    if (p.visited.includes(me)) return { loop: [...p.visited, me], holonomy: 1 };
    const raw = await delegate(
      PORT0 + neighbour(p.dir),
      { tag: "Walk", dir: p.dir, visited: [...p.visited, me] },
      depth,
    );
    const r = decodeClosed(raw);
    return { loop: r.loop, holonomy: (eps(p.dir) * r.holonomy) as Sign };
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
    return { value: u.value, hops: u.hops, path: u.path as NodeId[] };
  }
  return bad("Carried", u);
}

function decodeBounded(u: unknown): Bounded {
  if (isRecord(u) && Array.isArray(u.path)) {
    if (u.tag === "Exhausted") return { tag: "Exhausted", path: u.path as NodeId[] };
    if (u.tag === "Carried" && isSign(u.value)) {
      return { tag: "Carried", value: u.value, path: u.path as NodeId[] };
    }
  }
  return bad("Bounded", u);
}

function decodeClosed(u: unknown): LoopClosed {
  if (isRecord(u) && isSign(u.holonomy) && Array.isArray(u.loop)) {
    return { loop: u.loop as NodeId[], holonomy: u.holonomy };
  }
  return bad("LoopClosed", u);
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
      return isCocycle(u.edges) && isSign(u.value)
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
      return isDir(u.dir) && Array.isArray(u.visited) && u.visited.every(isNodeId)
        ? { tag: "Walk", dir: u.dir, visited: u.visited as NodeId[] }
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
