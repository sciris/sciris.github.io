#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

remove() {
  local target=$1
  if [ -e "$target" ]; then
    local count size
    count=$(find "$target" | wc -l | tr -d ' ')
    size=$(du -sh "$target" | cut -f1)
    echo "Removing $target ($count items, $size)..."
    rm -rf "$target"
  else
    echo "Skipping $target (not present)"
  fi
}

remove _site
remove node_modules

echo "Done."
