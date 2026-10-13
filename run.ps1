# ReqClear task runner for Windows (PowerShell).   Usage:
#   powershell -ExecutionPolicy Bypass -File .\run.ps1 setup | dev | start | test
# Uses a plain Python venv (.venv) - no conda needed. Requires Python 3.11+ and Node 20.19+.
param([Parameter(Position = 0)][string]$Command = "")

$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

$BackendPort  = if ($env:BACKEND_PORT)  { $env:BACKEND_PORT }  else { "8000" }
$FrontendPort = if ($env:FRONTEND_PORT) { $env:FRONTEND_PORT } else { "5173" }
$Venv   = Join-Path $PSScriptRoot ".venv"
$VenvPy = Join-Path $Venv "Scripts\python.exe"

function Say($m) { Write-Host ">> $m" -ForegroundColor Magenta }
function Die($m) { Write-Host "X  $m" -ForegroundColor Red; exit 1 }

function Find-Python {
    foreach ($c in @(@("python"), @("py", "-3"))) {
        $exe = Get-Command $c[0] -ErrorAction SilentlyContinue
        if ($exe) {
            $probe = @($c | Select-Object -Skip 1) + @("-c", "import sys; print(sys.version_info >= (3, 11))")
            $ok = & $c[0] @probe 2>$null
            if ($ok -eq "True") { return ,$c }
        }
    }
    Die "Python 3.11+ not found. Install it from https://www.python.org/downloads/ (tick 'Add python.exe to PATH')."
}
function Need-Node {
    if (-not (Get-Command node -ErrorAction SilentlyContinue) -or -not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Die "Node.js 20.19+ not found. Install it from https://nodejs.org"
    }
}
function Need-Venv { if (-not (Test-Path $VenvPy)) { Die "Python environment missing. Run: .\run.ps1 setup" } }
function Check-Key {
    $envFile = Join-Path $PSScriptRoot "backend\.env"
    $has = (Test-Path $envFile) -and (Select-String -Path $envFile -Pattern '^GEMINI_API_KEY=.+' -Quiet)
    if (-not $has) { Write-Host "! No GEMINI_API_KEY in backend\.env - the app will run in offline keyword-rules mode." -ForegroundColor Yellow }
}

function Cmd-Setup {
    Need-Node
    $py = Find-Python
    if (-not (Test-Path $VenvPy)) {
        Say "Creating Python virtual environment (.venv)"
        $a = @($py | Select-Object -Skip 1) + @("-m", "venv", $Venv)
        & $py[0] @a
        if ($LASTEXITCODE -ne 0) { Die "Could not create the virtual environment." }
    }
    Say "Installing backend packages"
    & $VenvPy -m pip install --upgrade pip
    & $VenvPy -m pip install -r backend\requirements.txt
    if ($LASTEXITCODE -ne 0) { Die "pip install failed (see the error above)." }
    Say "Installing frontend packages"
    Push-Location frontend; npm ci; $rc = $LASTEXITCODE; Pop-Location
    if ($rc -ne 0) { Die "npm ci failed." }
    if (-not (Test-Path "backend\.env")) {
        Copy-Item "backend\.env.example" "backend\.env"
        Say "Created backend\.env - open it and set GEMINI_API_KEY=your-key (https://aistudio.google.com/apikey)"
    }
    Say "Setup complete. Next: .\run.ps1 start   (or .\run.ps1 dev)"
}

function Cmd-Dev {   # backend (auto-reload) + Vite dev server (hot reload)
    Need-Venv; Need-Node; Check-Key
    if (-not (Test-Path "frontend\node_modules")) { Die "Frontend packages missing. Run: .\run.ps1 setup" }
    Say "Backend  -> http://localhost:$BackendPort  (API docs: /docs)"
    $be = Start-Process -FilePath $VenvPy -WorkingDirectory (Join-Path $PSScriptRoot "backend") -NoNewWindow -PassThru `
          -ArgumentList @("-m", "uvicorn", "app.main:app", "--reload", "--port", $BackendPort)
    try {
        Say "Frontend -> http://localhost:$FrontendPort   (press Ctrl+C to stop both)"
        $env:API_URL = "http://localhost:$BackendPort"
        Push-Location frontend
        npx vite --port $FrontendPort --strictPort
    } finally {
        Pop-Location -ErrorAction SilentlyContinue
        if ($be -and -not $be.HasExited) { & taskkill /PID $be.Id /T /F | Out-Null }  # also kills uvicorn's reload worker
    }
}

function Cmd-Start { # production style: build the UI once, serve UI + API from one port
    Need-Venv; Need-Node; Check-Key
    if (-not (Test-Path "frontend\node_modules")) { Die "Frontend packages missing. Run: .\run.ps1 setup" }
    Say "Building frontend"
    Push-Location frontend; npm run build; $rc = $LASTEXITCODE; Pop-Location
    if ($rc -ne 0) { Die "Frontend build failed." }
    Say "ReqClear -> http://localhost:$BackendPort   (Ctrl+C to stop)"
    Set-Location backend
    & $VenvPy -m uvicorn app.main:app --host 127.0.0.1 --port $BackendPort
}

function Cmd-Test {
    Need-Venv; Need-Node
    Say "Installing test packages"; & $VenvPy -m pip install -q -r backend\requirements-dev.txt
    Say "Backend tests";  Push-Location backend;  & $VenvPy -m pytest -q; Pop-Location
    Say "Frontend types"; Push-Location frontend; npx tsc -b
    Say "Frontend tests"; npx vitest run; Pop-Location
}

switch ($Command) {
    "setup" { Cmd-Setup }
    "dev"   { Cmd-Dev }
    "start" { Cmd-Start }
    "test"  { Cmd-Test }
    default {
        Write-Host "Usage: powershell -ExecutionPolicy Bypass -File .\run.ps1 {setup|dev|start|test}"
        Write-Host "  setup  create .venv, install backend + frontend packages, create backend\.env"
        Write-Host "  start  build the UI and serve everything on http://localhost:8000"
        Write-Host "  dev    backend + frontend with hot reload"
        Write-Host "  test   unit tests (e2e tests are macOS/Linux-only for now)"
        exit 1
    }
}
