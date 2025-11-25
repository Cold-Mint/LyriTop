#!/bin/sh

glib-compile-schemas schemas/

OUTPUT="lyritop@coldmint.shell-extension.zip"

# 删除旧文件
[ -f "$OUTPUT" ] && rm "$OUTPUT"

echo "Packaging files into $OUTPUT ..."

zip -r "$OUTPUT" \
  metadata.json \
  mediaMonitor.js \
  lyricsManager.js \
  lrcParser.js \
  extension.js \
  prefs.js \
  schemas \
  stylesheet.css

echo "Packaging completed: $OUTPUT"