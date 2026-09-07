#!/bin/sh
if [ -f /tmp/mobius.pids ]; then
  while read -r pid; do kill "$pid" 2>/dev/null || true; done < /tmp/mobius.pids
  rm -f /tmp/mobius.pids
fi
for p in 8811 8812 8813; do
  pid=$(lsof -ti "tcp:$p" 2>/dev/null || true)
  [ -n "$pid" ] && kill $pid 2>/dev/null || true
done
exit 0
