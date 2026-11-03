#!/bin/bash
# Parley — one-shot: git init → GitHub repo → Vercel production deploy. Double-click to run.
cd "$(dirname "$0")"
export PATH="$HOME/.npm-global/bin:$HOME/.bun/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
LOG="deploy.log"; : > "$LOG"
{
  echo "== $(date) =="
  echo "node: $(node -v 2>&1)  gh: $(gh --version 2>&1 | head -1)  vercel: $(vercel --version 2>&1 | head -1)"
  [ -d .git ] || git init -b main
  git rm -q --cached glyphbg.js 2>/dev/null; git add -A
  git commit -m "Parley v6 — aurora background, Siri ribbon, palettes, faster translation" -q || echo "(nothing new to commit)"
  if ! git remote get-url origin >/dev/null 2>&1; then
    gh repo create parley --public --source=. --remote=origin --push || { echo "gh repo create failed"; }
  else
    git push -u origin main
  fi
  echo "== vercel =="
  vercel --prod --yes 2>&1
  echo "== done =="
} 2>&1 | tee -a "$LOG"
echo; echo "Finished. You can close this window."
