#!/usr/bin/env bash
# Rebuild bundle/assets/native.js + assets from the Solarchik game repo.
# Usage: scripts/build-bundle.sh /path/to/Solarchik   (branch native-full)
set -euo pipefail
SRC=${1:?path to Solar-DePIN-Hub/Solarchik checkout}
HERE=$(cd "$(dirname "$0")/.." && pwd)
( cd "$SRC" && npx vite build -c vite.native.config.ts )
cp "$SRC/build-native/assets/native.js" "$SRC/build-native/assets/style.css" "$HERE/bundle/assets/"
rm -rf "$HERE/bundle/sprites" "$HERE/bundle/audio"
cp -r "$SRC/public/sprites" "$SRC/public/audio" "$SRC/public/yard-bg.jpg" "$SRC/public/room.jpg" "$SRC/public/favicon.svg" "$HERE/bundle/"
# Anna serves the bundle under /anna-apps/<slug>/<version>/, so make root-absolute asset paths relative.
python3 - "$HERE/bundle/assets/native.js" <<'PY'
import sys
p=sys.argv[1]; s=open(p).read()
for a in ['sprites/','audio/','yard-bg.jpg','room.jpg','favicon.svg']:
    for q in '"`\'':
        s=s.replace(q+'/'+a, q+'./'+a)
open(p,'w').write(s)
PY
echo "bundle rebuilt"
