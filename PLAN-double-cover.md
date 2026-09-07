# PLAN: the double cover, and what a centre costs

For whoever picks this up next. It assumes no knowledge of the conversation that
produced the repository, only the repository.

## Context

`sheaf-federation.pdf` §"The four repairs" claims:

> Pass to the universal cover. On a simply connected base the locally constant classes
> vanish, because there is no `π₁` to represent. **So orienting and unrolling are one
> construction.** The centre is available at the price of infinitely many copies of the
> federation, which is a precise statement of what a centre costs.

That is in print and it is asserted, not demonstrated. This plan demonstrates it.

`Z/2` makes it tractable in a way the general case is not. The relevant cover has order
two, so the "infinitely many copies" is **two copies and six nodes**, and the whole
universal cover fits on one machine.

## Why it was deferred, which is the thing to get right

The obvious version is wrong. Running `./mobius glue --fuel 6` multiplies by `(∏ε)² = +1`,
so **six hops trivialise the twist on the cylinder too**, and the naive demonstration prints
the same thing in both classes. It would prove nothing while appearing to prove everything.

What actually separates them is the deck transformation. Upstairs a global section exists in
both cases. In the trivial class the two sheets agree; in the non-trivial class they do not.
**That comparison is the entire content of this work.** If the implementation does not check
it, do not build the rest.

## The mathematics, worked, so you can check yourself

The `n`-fold cover of `S¹` pulls a 3-arc cover back to `3n` arcs. Take `n = 2`: six nodes,
six edges, and the upstairs transition data is the downstairs data repeated,
`ε_i = g_(i mod 3)`.

Holonomy upstairs is `(∏g)² = +1` always, for both classes. This is not a coincidence to be
explained away — it is `p*α = 0`, because `α : π₁(S¹) = Z → Z/2` is `n ↦ n mod 2` and the
cover's `π₁` maps onto `2Z`, on which `α` is trivial. So a section exists upstairs, always.

Build it from node 0 with `s₀ = +1` and `s_(i+1) = ε_i · s_i`. The deck transformation is
`σ(i) = i + 3 mod 6`.

**Möbius, `g = [+,+,−]`, so `ε = [+,+,−,+,+,−]`:**

```
s = [ +1, +1, +1, -1, -1, -1 ]
closure check:  ε₅ · s₅ = (-1)(-1) = +1 = s₀    it glues
σ*s vs s:       s₃=-1 ≠ s₀=+1,  s₄=-1 ≠ s₁,  s₅=-1 ≠ s₂     σ*s = -s
```

**Cylinder, `g = [+,+,+]`:**

```
s = [ +1, +1, +1, +1, +1, +1 ]
σ*s = +s
```

So the section exists in both, and `σ*s = (∏g) · s`. **The deck transformation recovers the
base class from a cover on which nothing is obstructed.** That sentence is the result.

## Design

### Generalise the ring to N nodes

`cocycle.ts` currently hardcodes three: `NodeId = 0 | 1 | 2`, and `step`/`epsilon` use `% 3`.
Take the modulus as a parameter. Keep the *base* at three — the type test asserting exactly
three arcs is about the base cover and must survive.

Suggested: `MOBIUS_RING=3|6` read by the servers, ports `8811 + i`, and `mobius-up.sh
--cover 2` starting six with the pulled-back signs. Do not simulate the cover in the CLI.
The cover is a real space, and computing it in the CLI would be the coordinator problem
again, which the repository already labels `[coordinator]` everywhere it occurs.

### One new fibre

```ts
| Fib<{ tag: "Deck" }, { node: N; antipode: N; transported: Sign; theirs: Sign; agree: boolean }>
```

Node `i` transports its own value the three hops to node `i + 3` and compares with what node
`i + 3` actually holds. The accumulated sign is `∏g` over the base, so the comparison returns
the base class — computed **in the ring**, on a cover where a section genuinely exists.

Reuse the existing recursion. `Deck` is `Ask` with fuel 3 plus one comparison, so it should
share the delegating handler rather than duplicate it. Keep the sign in the backward map,
which is non-negotiable and is the invariant the whole repository is built on.

### CLI

```
./mobius cover 2      # bring up six, build the section, check the deck transformation
./mobius deck         # the comparison, in the ring
```

`cover 2` must print, in this order: the pulled-back signs; the section upstairs; that it
**glues in both classes**; and only then `σ*s`. The ordering matters because a reader who
sees "it glues" first and stops has learned the wrong thing.

## What this must not claim

- **Not** that six hops trivialise the twist. They do that on the cylinder too. Say so
  explicitly, in the output, next to the number.
- **Not** that the obstruction has gone away. It has been pulled back to a cover where it is
  zero. Downstairs it is exactly where it was.
- The price is the point. A section exists upstairs and it is **not deck-invariant**, so the
  federation is consistent only by being two federations that disagree with each other. In
  `seven-federations.pdf` that is the Ridda outcome: the root transferred, and there ended up
  being two answers, each internally coherent. If a political reading is written down, that
  is the accurate one, and it should be one sentence, not a paragraph.

## Verification

```sh
deno check *.ts lib/*.ts
./mobius-up.sh --cover 2
./mobius cover 2      # expect: glues; s = +,+,+,-,-,-; sigma*s = -s
./mobius deck         # expect: -1, computed in the ring
./mobius flat
./mobius cover 2      # expect: glues; s = all +; sigma*s = +s
./mobius deck         # expect: +1
./mobius-down.sh
```

Then confirm the three-node ring is unchanged: `./mobius-up.sh` with no flag, and the whole
verification block at the bottom of `README.md` must still pass.

Add to `mobius-type-tests.ts`: that the cover has `3n` arcs for `n = 2`, and that
`Prod<Pullback<G>> = 1` for **both** classes, which is `p*α = 0` asserted in the checker.

## After this, the more honest one

The larger gap is elsewhere and is worth doing next. The triple overlap is currently empty,
so **the cocycle condition is vacuous** and the program never exercises coherence — while
`sheaf-federation.pdf` makes the cocycle condition its centrepiece. A fourth arc creating a
genuine triple overlap would close the largest distance between what the documents claim and
what the code shows. `./mobius nerve` exists only to stop a reader assuming otherwise, which
is a warning where a demonstration should be.
