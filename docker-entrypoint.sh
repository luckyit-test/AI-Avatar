#!/bin/sh
set -e

# API ключ больше не нужен во фронтенде - все запросы идут через серверный прокси
# Создаем пустой env.js для совместимости, если он где-то используется
HTML_DIR=/usr/share/nginx/html
OUT="$HTML_DIR/env.js"

echo "// API ключ больше не используется во фронтенде - все запросы через серверный прокси" > "$OUT"
echo "window.GEMINI_API_KEY='';" >> "$OUT"

nginx -g 'daemon off;'

