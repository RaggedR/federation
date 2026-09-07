# lib — vendored

`algebra.ts`, `wire.ts` and `delegate.ts` are copied verbatim from the `stalin`
project, which copied them verbatim from `tower`, an implementation of §4–§5 of
Neil Ghani's *Containers for Typed Agentic AI*: the four combinators
(`+`, `⊠`, `◁`, `×`) as first-class values, and a delegate/serve pair that makes
each hop between servers an actual CLI process.

They are vendored rather than depended on so this repository stands alone. That
this same library serves a planned economy in one repository and a Čech cocycle
in another is the point of vendoring it twice, and is a better test of whether it
is a library than either use alone.

Nothing in them is specific to either subject. Two consequences of that:

`wire.ts` reads an environment variable named `STALIN_INPROC`, which skips the
process-per-hop and keeps only the HTTP hop. The name belongs to the other
project. It is left alone because these files are vendored unmodified, and a
rename here would be the beginning of a fork.

There is exactly **one** divergence from upstream, inherited: `wire.ts`
originally imported `isRecord` from the tower's double-entry bookkeeping module,
so the four-line helper is inlined instead. Any other difference is a bug here,
not a feature.
