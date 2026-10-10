#!/usr/bin/env bash
# No dependencies, source requests or database access. Dispatch remains available.
set -euo pipefail
case "${1:-}" in
  workflow_dispatch) exit 0 ;;
  schedule) ;;
  *) echo 'Unsupported collection event; refusing work.' >&2; exit 1 ;;
esac

# Europe/Vilnius is UTC+03:00 on 2026-10-11. Equality is expired.
cutoff_epoch=1791702000 # 2026-10-11T07:00:00Z
now_epoch=$(date -u +%s)
if [[ "$now_epoch" =~ ^[0-9]+$ ]] && (( now_epoch < cutoff_epoch )); then
  exit 0
fi
echo 'Scheduled collection window expired; skipping setup, polling and DB access.'
exit 1
