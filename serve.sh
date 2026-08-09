#!/bin/bash
# Build the site and serve it at http://localhost:8080, rebuilding on changes
set -euo pipefail
cd "$(dirname "$0")"
npm install
npx eleventy --serve --port=8080
