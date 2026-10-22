#!/usr/bin/env sh
# Build one image per template: okta-tpl-<id>. Set NPM_REGISTRY to use an internal mirror.
set -e
cd "$(dirname "$0")/.."
for dir in templates/*/; do
  id=$(basename "$dir")
  [ -f "$dir/template.json" ] || continue
  echo "==> okta-tpl-$id"
  docker build -f docker/template.Dockerfile \
    --build-arg TEMPLATE="$id" --build-arg NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmjs.org/}" \
    -t "okta-tpl-$id" .
done
