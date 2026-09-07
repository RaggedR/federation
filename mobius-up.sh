#!/bin/sh
# mobius-up.sh — three arcs of a cover, listening.
#
# Deliberately NOT wired into up.sh/down.sh. up.sh runs down.sh first, so if
# down.sh knew these ports every game launch would silently kill a running ring.
# Separate range, separate pid file, separate lifecycle.
#
#   MOBIUS_SIGNS  the three edge transitions, default "+,+,-" (the Mobius band)
set -e
cd "$(dirname "$0")"

./mobius-down.sh >/dev/null 2>&1 || true
./wait-ports.sh free 0 8811 8812 8813

export MOBIUS_SIGNS="${MOBIUS_SIGNS:-+,+,-}"

# One log, not three. The interleaving of hops IS the demonstration, and three
# files destroy it. Append-mode writes of a short line are atomic, so the order
# of the file is the causal order of the hops.
: > /tmp/mobius.log

for i in 0 1 2; do
  MOBIUS_NODE=$i deno run --quiet --allow-net --allow-run --allow-read --allow-env \
    mobius.server.ts >> /tmp/mobius.log 2>&1 &
  echo "$!" >> /tmp/mobius.pids
done

./wait-ports.sh up 3 8811 8812 8813
echo "up: node0 :8811  node1 :8812  node2 :8813   signs $MOBIUS_SIGNS"
echo "    trace: tail -f /tmp/mobius.log"
