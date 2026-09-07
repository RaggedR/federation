#!/bin/sh
# Kills the base ring and any cover of it. The port range is fixed at twelve so
# that a cover left running is never invisible to this script: an orphaned ring
# keeps turning by itself, which is a documented property of the thing.
if [ -f /tmp/mobius.pids ]; then
  while read -r pid; do kill "$pid" 2>/dev/null || true; done < /tmp/mobius.pids
  rm -f /tmp/mobius.pids
fi
for p in 8811 8812 8813 8814 8815 8816 8817 8818 8819 8820 8821 8822; do
  pid=$(lsof -ti "tcp:$p" 2>/dev/null || true)
  [ -n "$pid" ] && kill $pid 2>/dev/null || true
done
exit 0
