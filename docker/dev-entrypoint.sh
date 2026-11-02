#!/bin/sh
set -eu

cd /workspace

# Named volumes are root-owned on first creation. The process then drops to
# the unprivileged node user before installing dependencies or starting the app.
if [ "$(id -u)" = "0" ]; then
  mkdir -p node_modules apps/api/node_modules apps/web/node_modules /home/node
  chown node:node node_modules apps/api/node_modules apps/web/node_modules /home/node
  export HOME=/home/node
  exec setpriv --reuid=node --regid=node --init-groups -- "$0" "$@"
fi

if [ ! -d node_modules/.pnpm ]; then
  pnpm install --frozen-lockfile
fi

exec "$@"
