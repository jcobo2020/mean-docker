# Levanta API y Frontend en local (MongoDB debe estar en Docker)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Ensure-ApiEnv {
    $ApiEnv = Join-Path $Root "api\.env"
    $RootEnv = Join-Path $Root ".env"

    if (Test-Path $ApiEnv) {
        return
    }

    if (Test-Path $RootEnv) {
        $content = Get-Content $RootEnv -Raw
        $content = $content -replace "MONGO_DB_HOST=database", "MONGO_DB_HOST=localhost"
        Set-Content -Path $ApiEnv -Value $content -NoNewline
        Write-Host "Creado api\.env con MONGO_DB_HOST=localhost"
    }
    else {
        @"
PORT=3000
SECRET=your-jwt-secret-key
MONGO_DB_USERNAME=dbuser
MONGO_DB_PASSWORD=password123
MONGO_DB_HOST=localhost
MONGO_DB_PORT=27017
MONGO_DB_DATABASE=contact_db
MONGO_DB_PARAMETERS=?authSource=admin
"@ | Set-Content -Path $ApiEnv
        Write-Host "Creado api\.env por defecto"
    }
}

function Ensure-Dependencies([string]$ProjectPath) {
    $NodeModules = Join-Path $ProjectPath "node_modules"
    if (-not (Test-Path $NodeModules)) {
        Write-Host "Instalando dependencias en $ProjectPath ..."
        Push-Location $ProjectPath
        try {
            npm install
        }
        finally {
            Pop-Location
        }
    }
}

function Stop-Port([int]$Port) {
    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if (-not $connections) {
        Write-Host "Puerto $Port libre."
        return
    }

    $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($processId in $processIds) {
        if ($processId -le 0) {
            continue
        }

        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "Puerto $Port ocupado por PID $processId ($($process.ProcessName)). Deteniendo..."
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        }
    }

    Start-Sleep -Seconds 1

    $stillListening = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($stillListening) {
        Write-Warning "No se pudo liberar completamente el puerto $Port."
    }
    else {
        Write-Host "Puerto $Port liberado."
    }
}

Ensure-ApiEnv
Ensure-Dependencies (Join-Path $Root "api")
Ensure-Dependencies (Join-Path $Root "frontend")

Write-Host "Verificando puertos 3000 y 4200..."
Stop-Port 3000
Stop-Port 4200


$ApiCommand = "Set-Location '$Root\api'; npm run dev:watch"
$FrontendCommand = "Set-Location '$Root\frontend'; npm run serve"

Write-Host "Iniciando API (http://localhost:3000) ..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", $ApiCommand

Write-Host "Iniciando Frontend (http://localhost:4200) ..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", $FrontendCommand

Write-Host ""
Write-Host "Ambos servicios iniciados en ventanas separadas."
Write-Host "Frontend: http://localhost:4200"
Write-Host "API:      http://localhost:3000"
Write-Host "Login:    nitin27may@gmail.com / P@ssword#321"
