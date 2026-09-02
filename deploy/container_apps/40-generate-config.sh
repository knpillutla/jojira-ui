#!/bin/sh
set -e

# 1. Substitute application container FQDN hostnames in Nginx config template
if [ -f /etc/nginx/templates/default.conf.template ]; then
  envsubst '$CONTAINER_APP_USER_SERVICE_HOST $CONTAINER_APP_API_HOST' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
fi

# 2. Substitute runtime client config variables in config.json template only when valid
if [ -f /usr/share/nginx/html/config.json.template ]; then
  if [ -n "$GOOGLE_MAPS_API_KEY" ] || [ -n "$GOOGLE_CLIENT_ID" ]; then
    envsubst '$GOOGLE_CLIENT_ID $GOOGLE_MAPS_API_KEY $ENVIRONMENT' < /usr/share/nginx/html/config.json.template > /usr/share/nginx/html/config.json
  fi
fi
