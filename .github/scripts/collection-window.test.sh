#!/usr/bin/env bash
set -euo pipefail
script_dir=$(cd -- "$(dirname -- "$0")" && pwd)
test_dir=$(mktemp -d)
trap 'rm -rf -- "$test_dir"' EXIT
printf '#!/usr/bin/env bash\nprintf "%%s\\n" "$TEST_EPOCH"\n' > "$test_dir/date"
chmod +x "$test_dir/date"
export PATH="$test_dir:$PATH"

check() {
  local expected=$1 event=$2 actual=0
  export TEST_EPOCH=$3
  bash "$script_dir/collection-window.sh" "$event" >/dev/null 2>&1 || actual=$?
  [[ "$actual" == "$expected" ]] || { echo "Failed: $event at $TEST_EPOCH" >&2; exit 1; }
}
check 0 schedule 1791701999
check 1 schedule 1791702000
check 1 schedule 1791702001
check 1 schedule invalid
check 0 workflow_dispatch 1791702001
check 1 push 1791701999
GROW_EV_COLLECTION_MODE=permanent check 1 workflow_dispatch 1791702001
GROW_EV_COLLECTION_MODE=permanent GROW_EV_PERMANENT_COLLECTION=approved GROW_EV_HISTORY_ENABLED=approved GROW_EV_SCHEDULER=cloudflare check 0 workflow_dispatch 1791702001
GROW_EV_COLLECTION_MODE=permanent GROW_EV_PERMANENT_COLLECTION=approved GROW_EV_HISTORY_ENABLED=approved check 1 workflow_dispatch 1791702001
GROW_EV_SCHEDULER=cloudflare check 1 schedule 1791701999
echo 'Collection window: 10 checks passed (cutoff, permanent approval gates, scheduler exclusivity).'
