#!/bin/sh
set -e

# Substitute environment variables into config.json at runtime
if [ -f /usr/share/nginx/html/config.json.template ]; then
  envsubst < /usr/share/nginx/html/config.json.template > /usr/share/nginx/html/config.json
fi

# Execute standard Nginx entrypoint
exec /docker-entrypoint.sh "$@"
