#!/bin/bash
rm -rf "debug-run"
mkdir "debug-run"
gnome-extensions pack --extra-source=./lrcParser.js --extra-source=./lyricsManager.js --extra-source=./mediaMonitor.js  --podir=po . -o ./debug-run
cd debug-run
gnome-extensions install lyritop@coldmint.shell-extension.zip --force
dbus-run-session gnome-shell --devkit --wayland