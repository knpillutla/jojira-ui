#!/bin/sh
set -e

# 1. Substitute only application container hostnames in Nginx config template
if [ -f /etc/nginx/templates/default.conf.template ]; then
  envsubst '$CONTAINER_APP_USER_SERVICE_NAME $CONTAINER_APP_API_NAME' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
fi

# 2. Substitute runtime client config variables in config.json template
if [ -f /usr/share/nginx/html/config.json.template ]; then
  envsubst '$GOOGLE_CLIENT_ID $GOOGLE_MAPS_API_KEY $ENVIRONMENT' < /usr/share/nginx/html/config.json.template > /usr/share/nginx/html/config.json
fi
