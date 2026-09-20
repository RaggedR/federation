# federation

**When can local agreement be assembled into a global object, and what exactly stops it?**

Three servers in a ring, coefficients in `Z/2`, and a first cohomology with exactly two
classes. Flip one sign and a structure with a global section becomes one without, with no
change to any code. That is what it means for `H^1` to classify the covering data rather
than describe the space.

Built on the four combinators of §5 of Neil Ghani's *Containers for Typed Agentic AI*,
vendored unmodified into [`lib/`](lib/). Requires [Deno](https://deno.com) 2.x. No install
step, no lockfile, no dependencies beyond the standard library.

```
./mobius-up.sh          # three arcs of a cover, on 8811-8813
./mobius class          # the class
./mobius holonomy       # carry a value once round; watch it come back negated
./mobius glue --detect  # walk the ring and report the obstruction
./mobius-down.sh

./mobius-up.sh --cover 2   # six arcs: the double cover, on 8811-8816
./mobius cover 2           # a section exists upstairs, and it is not deck-invariant
./mobius deck              # the comparison, in the ring
```

## The question

A federation is a collection of members, each with local authority, each answerable to its
neighbours. Formally each member **has** a container and **is** a morphism: the container is
its interface, written `P ◁ R`, the prompts it accepts and the type of a valid response to
each; the morphism is its behaviour, answering prompts on its own interface by issuing
prompts on its neighbours' and translating the replies back.

So a federation is not a composite of containers. It is a diagram of morphisms between
containers, and its graph has cycles. The four combinators build trees.

Documents work that out, and one program tests it.

| | |
|---|---|
| [`federation.pdf`](federation.pdf) | *The Missing Trace.* Why a federation is not a composite. The obstruction is in the response direction: prompts travel round the cycle freely because the forward map is covariant, and the failure is entirely in the backward map. |
| [`sheaf-federation.pdf`](sheaf-federation.pdf) | *A Sheaf Theory of Federation.* A federation is the claim that a presheaf is a sheaf. The obstruction is a class in `H^1`, and it is carried by `π₁`. Cycles do not merely fail to terminate. They act. |
| [`seven-federations.pdf`](seven-federations.pdf) | *The Root Outside the Set.* Persia, Abraham, Muhammad, Putin, the USA, the EU and corporate mergers, each read as a repair of the same cyclic structure. |
| [`coherence.pdf`](coherence.pdf) | *Coherence.* A and B federate, B and C federate, A and C does not. That is the cocycle condition failing, which is a degree above the obstruction this program computes. Shows that a three-patch cover cannot exhibit both failures, gives a verified four-arc cover that can, and identifies when compartmentalisation is unavailable. |
| [`almost-computable.pdf`](almost-computable.pdf) | *Almost Computable.* The Myhill–Nerode refinement of the path directed container of a graph produces this ring's double cover, node for node, with the section as its state set. Corrects the claim that a centre costs infinitely many copies: it costs the order of the holonomy. |
| [`mobius.pdf`](mobius.pdf) | *Möbius.* The program itself, in container language. What each fibre is, why the deck comparison needs two backward maps, and two appendices: containers in TypeScript via the dependent lookup, and why every node is a separate process. |
| [`trace-and-class.pdf`](trace-and-class.pdf) | *The Trace and the Class.* Answers the question `sheaf-federation` left open. The two obstructions are independent and obstruct different properties: well-foundedness governs existence, the class governs canonicity. The unbounded walk diverges on the cylinder, where nothing is obstructed; the cut repair returns in both classes and differs only in whether the answer depends on the cut. `independence.ts` checks it on all eight cocycles. |

## The mathematics, which drove every decision

Cover the circle with three arcs, each slightly over a third, so every pairwise overlap is a
single arc and the triple overlap is empty. Coefficients in `Z/2 = {+1,-1}`, multiplicative.

```
C0 = C1 = (Z/2)^3,  C2 = 0
(d0 a)_ij = a_i a_j,  ker d0 = the constants, so B1 has rank 2
Z1 = C1, because d1 lands in 0
=> H1 = Z/2
```

and `B1` is exactly the subgroup where the product of the three edges is `+1`. Two classes
and no more. Product `+1` is the cylinder. Product `-1` is the Möbius band.

Arc size matters. With two arcs the overlap has two components and the rank computation is
different. `./mobius nerve` prints the ranks.

## The double cover, and what a centre costs

`sheaf-federation.pdf` says the centre is available at the price of infinitely many copies
of the federation. With `Z/2` that price is two copies and six nodes, so it can be paid and
inspected rather than asserted.

`./mobius-up.sh --cover 2` starts six servers carrying the base data repeated, `ε_i = g_(i
mod 3)`. The cover is a real space with real processes on it; computing it in the CLI would
be electing a coordinator, which is the thing under study.

**The obvious version of this is wrong**, and the repository would be worse for containing
it. The holonomy upstairs is `(∏g)² = +1` in *both* classes, so six hops trivialise the twist
on the cylinder too, and a demonstration that stopped at the closure check would print the
same thing either way. That is not a coincidence to be explained away. It is `p*α = 0`: `α :
π₁(S¹) = Z → Z/2` is `m ↦ m mod 2`, the cover's `π₁` maps onto `2Z`, and `α` is trivial
there. It is the reason a section exists at all.

What separates the classes is the deck transformation `σ(i) = i + 3 mod 6`. Build the section
from node 0 with `s₀ = +1` and `s_(i+1) = ε_i · s_i`:

```
mobius    ε = +,+,-,+,+,-      s = +1 +1 +1 -1 -1 -1      σ*s = -s
cylinder  ε = +,+,+,+,+,+      s = +1 +1 +1 +1 +1 +1      σ*s = +s
```

Both glue. Neither is obstructed. But `σ*s = (∏g) · s`, so **the deck transformation recovers
the base class from a cover on which nothing is obstructed**, and the price is exact: a
section exists upstairs and it is not deck-invariant, so the federation is consistent only by
being two federations that disagree with each other. In `seven-federations.pdf` that is the
Ridda outcome, where the root transferred and there ended up being two answers, each
internally coherent.

The obstruction has not gone away. It has been pulled back to a cover where it is zero, and
downstairs it is exactly where it was.

`./mobius deck` does the comparison **in the ring**. One walk carries two values back under
two different backward maps: `transported` is multiplied by `ε` at every frame, exactly as
`Ask` does, and `theirs` is relayed untouched, because the covering map identifies the fibre
over arc `i` with the fibre over arc `i + 3` and that identification is the identity rather
than a transition function. The nodes in between relay `theirs` without reading it, which
they must, since they lie over a different arc and it is not in their frame. Both maps are
honest and they differ by the class of the base.

Note what a fibre reporting only `transported` would say. Transport round three hops is how
the section was built, so it agrees with the far node by construction, in either class. The
comparison is the whole content, and one half of it is not a demonstration.

## The four repairs are four fibres of one container

None of them is a change of program.

| fibre | base case | what it is |
|---|---|---|
| `Ask` | fuel 0, answer locally | transport; the value comes back negated |
| `Unroll` | fuel 0, `Exhausted` | `F^n` of bottom, which is bottom, for every `n` |
| `Orient` | none | the unbounded one; it does not return |
| `Walk` | sees itself in `visited` | cycle detection, and what it reports is the class |
| `Deck` | fuel 0, answer locally | `Ask` again, carrying a second value under the identity |

Four differ only in the prompt and one only in the response type. That is why fuel rides in
the prompt rather than in the depth header: a header cannot be a type, and putting it in the
prompt is what lets `mobius-type-tests.ts` assert `F^0` of bottom at compile time.

The sign lives in the **backward map and nowhere else**. A prompt carries no value — it says
*tell me your local value* — because a value travelling outward would put the transition
function in the forward map, which is the wrong one.

## The obstruction, as a compiler diagnostic

The first thing in the type tests:

```ts
const path = seqC(n0, seqC(n1, n2));   // fine: a path is a tree
const ring = seqC(n2, ring);           // TS7022: referenced in its own initializer
```

and then the same obstruction bought back with a thunk, which compiles and does not
terminate. **Containers type the interface and say nothing about the well-foundedness of the
composite.** That is the finding, and it is why the unbounded fibre exists at all.

The rest of that file computes `H^1` in the type checker by enumerating all eight 0-chains,
which is a complete verification rather than a sample.

## Measured, not asserted

`./mobius glue` reached **441 hops in 8 seconds**, one live process per hop, with the depth
counter marching alongside. Abandoning the request does not stop it: the ring kept turning at
about fifty hops a second with nobody asking, reaching 915 live processes before it was
killed. Only `./mobius-down.sh` stops it, and it stops silently, because SIGTERM does not
give the handlers a chance to report.

Nothing deadlocks. Nothing is blocked on a peer. It is infinite regress, which is a different
thing, and the prose should not blur them.

## What this does not demonstrate

Stated here because a reader who has just finished the sheaf note will otherwise assume
otherwise.

The triple overlap is empty, so the **cocycle condition is vacuous**. This exhibits monodromy
and does not exercise coherence.

`Z/2` is abelian, so `./mobius commute` is a **path-independence** check and not a
commutativity one — order never mattered, in either class. Separating "commutative" from
"trivial monodromy" needs non-abelian coefficients, which would abandon `H^1(S^1;Z/2) = Z/2`.

Every element of `Z/2` is its own inverse, so `g_ji = g_ij^-1` is invisible and the two
directions give the same holonomy.

The forward map is near-identity, so every edge is a **vertical** morphism, an element of the
automorphism sheaf. Right for descent, and a degenerate corner of the container formalism.

And what is obstructed is the sheaf **twisted by the cocycle**. The constant sheaf `Z/2`
always has its two constant sections. `./mobius class` says so.

Commands are marked `[coordinator]` when the CLI polled all three nodes and did the
arithmetic itself, and `[in the ring]` when the backward maps did it. That distinction is not
cosmetic: electing a coordinator *is* the ORIENT repair, so a command that quietly does it
has answered a different question.

## Not built yet

A **guarded fibre** returning `Later`, differing from `Unroll` in the response type. A
**fourth arc**, where the cocycle condition would start to bite, which is the largest
remaining distance between what the documents claim and what the code shows. And a
**non-trivial forward map**, so that both directions of the morphism are visible.

## Verify

```
deno check *.ts lib/*.ts     # includes the type tests; fails in both directions
./mobius-up.sh
./mobius nerve               # the rank computation
./mobius signs               # neighbours agree on every shared edge
./mobius class               # mobius band, 0 global sections of the twisted sheaf
./mobius holonomy            # comes back -1
./mobius glue --detect       # loop closed, holonomy -1
./mobius cut-compare         # three cuts, three different sections
./mobius gauge --flip 1      # two edges move, the class does not
./mobius flat && ./mobius class    # cylinder, 2 sections — same code, different data
./mobius glue                # states what would stop it, then does not return
./mobius-down.sh
```

and the double cover, which is a different ring and so a separate lifecycle:

```
./mobius-up.sh --cover 2
./mobius cover 2             # glues; s = +,+,+,-,-,-; ratio -1; sigma*s = -s
./mobius deck                # -1, in the ring
./mobius class               # cylinder upstairs, in BOTH classes — see the caveat it prints
./mobius flat
./mobius cover 2             # glues; s = all +; ratio +1; sigma*s = +s
./mobius deck                # +1
./mobius-down.sh
```
