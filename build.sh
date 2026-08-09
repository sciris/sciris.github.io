#!/bin/bash
# Build the site into _site
set -euo pipefail
cd "$(dirname "$0")"
npm install
npx eleventy
