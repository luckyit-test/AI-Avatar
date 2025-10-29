#!/bin/sh
set -e

HTML_DIR=/usr/share/nginx/html
TEMPLATE="$HTML_DIR/env.template.js"
OUT="$HTML_DIR/env.js"

if [ -f "$TEMPLATE" ]; then
  # inject runtime env var
  sh -c "GEMINI_API_KEY=${GEMINI_API_KEY} envsubst '\$GEMINI_API_KEY' < $TEMPLATE > $OUT" || echo "window.GEMINI_API_KEY='';" > "$OUT"
else
  echo "window.GEMINI_API_KEY='';" > "$OUT"
fi

nginx -g 'daemon off;'
