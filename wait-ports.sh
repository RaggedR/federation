#!/bin/sh
# wait-ports.sh <free|up> [n] [ports...] — block until the ports are all free,
# or until exactly n of them are listening.
want="$1"
shift 2>/dev/null || true
if [ $# -gt 0 ]; then need="$1"; shift; else need=3; fi
ports="${*:-8811 8812 8813}"
for _ in $(seq 1 50); do
  n=0
  for p in $ports; do
    if lsof -ti "tcp:$p" >/dev/null 2>&1; then n=$((n + 1)); fi
  done
  case "$want" in
    free) [ "$n" -eq 0 ] && exit 0 ;;
    up)   [ "$n" -eq "$need" ] && exit 0 ;;
  esac
  sleep 0.2
done
echo "wait-ports: gave up waiting for ports to be $want" >&2
exit 1
