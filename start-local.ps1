[CmdletBinding()]
param(
  [switch]$Durable,
  [switch]$SkipInstall,
  [switch]$NoDev
)

$ErrorActionPreference = 'Stop'
$workspaceRoot = $PSScriptRoot

if (-not (Test-Path -LiteralPath (Join-Path $workspaceRoot 'package.json'))) {
  throw "No se encontro package.json en $workspaceRoot"
}

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
  throw 'Node.js 22 o posterior no esta instalado o no aparece en PATH.'
}

$pnpmCommand = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
if (-not $pnpmCommand) {
  $pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
}
$corepackCommand = Get-Command corepack.cmd -ErrorAction SilentlyContinue
if (-not $corepackCommand) {
  $corepackCommand = Get-Command corepack -ErrorAction SilentlyContinue
}

if (-not $pnpmCommand -and -not $corepackCommand) {
  throw 'No se encontro pnpm ni Corepack. Reinstala Node.js habilitando Corepack.'
}

function Invoke-WorkspacePnpm {
  param([Parameter(Mandatory = $true)][string[]]$PnpmArguments)

  if ($pnpmCommand) {
    & $pnpmCommand.Source @PnpmArguments
  } else {
    & $corepackCommand.Source pnpm @PnpmArguments
  }

  if ($LASTEXITCODE -ne 0) {
    throw "pnpm $($PnpmArguments -join ' ') termino con codigo $LASTEXITCODE."
  }
}

Push-Location $workspaceRoot
try {
  Write-Host "ATLAS ESTATES - $workspaceRoot" -ForegroundColor Magenta
  Write-Host "Node $(& $nodeCommand.Source --version)"

  if (-not $SkipInstall) {
    Write-Host 'Instalando dependencias...' -ForegroundColor Cyan
    Invoke-WorkspacePnpm @('install')
  }

  Write-Host 'Generando Prisma Client...' -ForegroundColor Cyan
  Invoke-WorkspacePnpm @('--filter', '@circuit/database', 'generate')

  Write-Host 'Compilando el motor de juego...' -ForegroundColor Cyan
  Invoke-WorkspacePnpm @('--filter', '@circuit/game-engine', 'build')

  if ($Durable) {
    $env:DATABASE_DISABLED = 'false'
    if (-not $env:DATABASE_URL) {
      $envPath = Join-Path $workspaceRoot '.env'
      if (Test-Path -LiteralPath $envPath) {
        $databaseLine = Get-Content -LiteralPath $envPath |
          Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } |
          Select-Object -First 1
        if ($databaseLine) {
          $env:DATABASE_URL = ($databaseLine -split '=', 2)[1].Trim().Trim('"').Trim("'")
        }
      }
    }
    if (-not $env:DATABASE_URL) {
      throw 'El modo -Durable necesita DATABASE_URL en el entorno o en el archivo .env.'
    }
    Write-Host 'Aplicando migraciones PostgreSQL...' -ForegroundColor Cyan
    Invoke-WorkspacePnpm @('--filter', '@circuit/database', 'migrate')
  } else {
    $env:DATABASE_DISABLED = 'true'
    Write-Host 'Persistencia efimera activada para desarrollo local.' -ForegroundColor Yellow
  }

  $lanAddress = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notlike '127.*' -and
      $_.IPAddress -notlike '169.254.*' -and
      $_.PrefixOrigin -ne 'WellKnown'
    } |
    Select-Object -ExpandProperty IPAddress -First 1
  if (-not $env:CORS_ORIGINS) {
    $allowedOrigins = @('http://localhost:5173', 'http://127.0.0.1:5173')
    if ($lanAddress) {
      $allowedOrigins += "http://${lanAddress}:5173"
    }
    $env:CORS_ORIGINS = $allowedOrigins -join ','
  }

  if ($NoDev) {
    Write-Host 'Preparacion completada; servidor no iniciado por -NoDev.' -ForegroundColor Green
    return
  }

  Write-Host 'Web: http://localhost:5173' -ForegroundColor Green
  Write-Host 'API: http://localhost:3001/health' -ForegroundColor Green
  if ($lanAddress) {
    Write-Host "Red local: http://${lanAddress}:5173" -ForegroundColor Green
  }
  Write-Host 'Pulsa Ctrl+C para detener ambos procesos.'
  Invoke-WorkspacePnpm @(
    '--parallel',
    '--filter',
    '@circuit/server',
    '--filter',
    '@circuit/web',
    'dev'
  )
} finally {
  Pop-Location
}
