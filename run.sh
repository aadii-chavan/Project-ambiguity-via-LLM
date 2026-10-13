#!/usr/bin/env bash
# ReqClear task runner.   ./run.sh setup | dev | start | test | e2e | eval
set -euo pipefail
cd "$(dirname "$0")"

ENV_NAME="${ENV_NAME:-req-ambiguity}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

say()  { printf '\033[1;35m▸ %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

find_conda() {
  if command -v conda >/dev/null 2>&1; then CONDA="$(command -v conda)"
  elif [ -n "${CONDA_EXE:-}" ]; then CONDA="$CONDA_EXE"
  else for c in "$HOME/miniconda3/bin/conda" "$HOME/opt/miniconda3/bin/conda" /opt/homebrew/Caskroom/miniconda/base/bin/conda /opt/miniconda3/bin/conda; do
         [ -x "$c" ] && CONDA="$c" && break; done
  fi
  [ -n "${CONDA:-}" ] || die "Miniconda not found. Install it from https://docs.conda.io/en/latest/miniconda.html"
}
env_python() {            # absolute python of the conda env (no shell activation needed)
  find_conda
  PY="$("$CONDA" run -n "$ENV_NAME" python -c 'import sys; print(sys.executable)' 2>/dev/null)" \
    || die "Conda env '$ENV_NAME' not found. Run: ./run.sh setup"
}
need_node() { command -v node >/dev/null && command -v npm >/dev/null || die "Node.js (>=20) is required: https://nodejs.org"; }

cmd_setup() {
  find_conda; need_node
  if "$CONDA" env list | awk '{print $1}' | grep -qx "$ENV_NAME"; then
    say "Updating conda env '$ENV_NAME'"; "$CONDA" env update -n "$ENV_NAME" -f environment.yml --prune
  else
    say "Creating conda env '$ENV_NAME' (Python 3.11)"; "$CONDA" env create -n "$ENV_NAME" -f environment.yml
  fi
  say "Installing frontend packages"; (cd frontend && npm ci)
  if [ ! -f backend/.env ]; then cp backend/.env.example backend/.env; say "Created backend/.env — add your GEMINI_API_KEY (get one at https://aistudio.google.com/apikey)"; fi
  say "Setup complete. Next: ./run.sh dev"
}

check_key() {
  grep -Eq '^GEMINI_API_KEY=.+' backend/.env 2>/dev/null || printf '\033[33m! No GEMINI_API_KEY in backend/.env — the app will run in offline keyword-rules mode.\033[0m\n'
}

cmd_dev() {   # backend with auto-reload + Vite dev server with hot reload
  env_python; need_node; check_key
  [ -d frontend/node_modules ] || die "Frontend packages missing. Run: ./run.sh setup"
  trap 'kill 0' EXIT INT TERM
  say "Backend  → http://localhost:$BACKEND_PORT  (API docs: /docs)"
  (cd backend && "$PY" -m uvicorn app.main:app --reload --port "$BACKEND_PORT") &
  say "Frontend → http://localhost:$FRONTEND_PORT"
  (cd frontend && API_URL="http://localhost:$BACKEND_PORT" npx vite --port "$FRONTEND_PORT" --strictPort) &
  wait
}

cmd_start() { # production: build the UI once, then a single process serves UI + API
  env_python; need_node; check_key
  [ -d frontend/node_modules ] || die "Frontend packages missing. Run: ./run.sh setup"
  if [ ! -f frontend/dist/index.html ] || [ -n "$(find frontend/src frontend/index.html -newer frontend/dist/index.html -print -quit)" ]; then
    say "Building frontend"; (cd frontend && npm run build)
  fi
  say "ReqClear → http://localhost:$BACKEND_PORT"
  cd backend && exec "$PY" -m uvicorn app.main:app --host 127.0.0.1 --port "$BACKEND_PORT"
}

cmd_test() {
  env_python; need_node
  say "Backend tests";  (cd backend && "$PY" -m pytest -q)
  say "Frontend types"; (cd frontend && npx tsc -b)
  say "Frontend tests"; (cd frontend && npx vitest run)
}

cmd_e2e() {
  env_python; need_node
  say "End-to-end tests (needs Google Chrome; no Gemini calls)"
  (cd frontend && PYTHON_BIN="$PY" npx playwright test)
}

cmd_eval() {  # calls Gemini (~200+ requests); results are cached
  env_python; check_key
  say "Evaluating on dev + held-out sets (see docs/04-evaluation.md)"
  (cd backend && "$PY" -m eval.run_eval --out results.json && "$PY" -m eval.run_eval --dataset heldout.jsonl --out results_heldout.json)
}

case "${1:-}" in
  setup) cmd_setup ;; dev) cmd_dev ;; start) cmd_start ;; test) cmd_test ;; e2e) cmd_e2e ;; eval) cmd_eval ;;
  *) echo "Usage: ./run.sh {setup|dev|start|test|e2e|eval}"; echo "  setup  create conda env, install frontend packages, create backend/.env"
     echo "  dev    backend + frontend with hot reload"; echo "  start  build UI and serve everything from one port"
     echo "  test   unit tests (backend + frontend)"; echo "  e2e    Playwright browser tests"; echo "  eval   run the Gemini evaluation"; exit 1 ;;
esac
