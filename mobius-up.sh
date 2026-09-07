#!/bin/sh
# mobius-up.sh — the arcs of a cover, listening.
#
# Deliberately NOT wired into up.sh/down.sh. up.sh runs down.sh first, so if
# down.sh knew these ports every game launch would silently kill a running ring.
# Separate range, separate pid file, separate lifecycle.
#
#   MOBIUS_SIGNS  the three BASE edge transitions, default "+,+,-" (the Mobius band)
#   --cover N     start the N-fold cover: 3N arcs, on 8811 upwards, carrying the
#                 base data repeated. The cover is a real space with real
#                 processes on it. Simulating it in the CLI would be the
#                 coordinator problem again, which is the thing being studied.
set -e
cd "$(dirname "$0")"

degree=1
if [ "$1" = "--cover" ]; then
  degree="${2:?--cover wants a degree, such as --cover 2}"
  shift 2
fi
case "$degree" in
  ''|*[!0-9]*) echo "mobius-up: --cover wants a whole number" >&2; exit 2 ;;
esac
[ "$degree" -ge 1 ] || { echo "mobius-up: --cover wants at least 1" >&2; exit 2; }

nodes=$((3 * degree))
ports=""
i=0
while [ "$i" -lt "$nodes" ]; do
  ports="$ports $((8811 + i))"
  i=$((i + 1))
done

./mobius-down.sh >/dev/null 2>&1 || true
./wait-ports.sh free 0 $ports

base="${MOBIUS_SIGNS:-+,+,-}"

# p*: the upstairs transition data is the downstairs data repeated, eps_i =
# g_(i mod 3). Built here rather than in the servers, because a server must not
# know it is on a cover — it hops to its neighbour modulo the ring it is in, and
# that is the whole difference between the base and the cover.
signs="$base"
k=1
while [ "$k" -lt "$degree" ]; do
  signs="$signs,$base"
  k=$((k + 1))
done

export MOBIUS_SIGNS="$signs"
export MOBIUS_RING="$nodes"

# One log, not three. The interleaving of hops IS the demonstration, and three
# files destroy it. Append-mode writes of a short line are atomic, so the order
# of the file is the causal order of the hops.
: > /tmp/mobius.log

i=0
while [ "$i" -lt "$nodes" ]; do
  MOBIUS_NODE=$i deno run --quiet --allow-net --allow-run --allow-read --allow-env \
    mobius.server.ts >> /tmp/mobius.log 2>&1 &
  echo "$!" >> /tmp/mobius.pids
  i=$((i + 1))
done

./wait-ports.sh up "$nodes" $ports

if [ "$degree" -eq 1 ]; then
  echo "up: $nodes arcs on$ports   signs $signs"
else
  echo "up: $nodes arcs on$ports   signs $signs   (the $degree-fold cover of $base)"
fi
echo "    trace: tail -f /tmp/mobius.log"
