#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p dist
rm -f dist/prompt-qa-copilot-extension.zip
zip -r dist/prompt-qa-copilot-extension.zip manifest.json src -x "*.DS_Store"

echo "Created dist/prompt-qa-copilot-extension.zip"
