#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

# 扫描常见源码/配置文件中的 Git 冲突标记，排除依赖与构建产物目录。
if matches=$(grep -RInE '^(<<<<<<< |=======|>>>>>>> )' \
  --exclude-dir=.git \
  --exclude-dir=node_modules \
  --exclude-dir=.next \
  --exclude-dir=dist \
  --exclude-dir=build \
  --exclude-dir=coverage \
  --exclude-dir=.turbo \
  --exclude-dir=.pnpm-store \
  --exclude-dir=.idea \
  --exclude-dir=.vscode \
  .); then
  echo "❌ Detected unresolved Git conflict markers:"
  echo "$matches"
  echo
  echo "Please resolve and remove all <<<<<<< / ======= / >>>>>>> markers before commit/build."
  exit 1
fi

echo "✅ No unresolved Git conflict markers found."
