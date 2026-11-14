#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Arranca el backend lunar en modo producción nativo con uv + uvicorn (sin Docker).
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $parts = $line.Split("=", 2)
            $key = $parts[0].Trim()
            $val = $parts[1].Trim()
            if (-not [Environment]::GetEnvironmentVariable($key)) {
                [Environment]::SetEnvironmentVariable($key, $val, "Process")
            }
        }
    }
}

$BindHost = if ($env:HOST) { $env:HOST } else { "0.0.0.0" }
$Port = if ($env:PORT) { $env:PORT } else { "8000" }
$Workers = if ($env:WORKERS) { $env:WORKERS } else { "2" }

Write-Host "Iniciando lunar-backend en http://${BindHost}:${Port} (workers=${Workers})..."
uv run --no-sync uvicorn app.main:app --host $BindHost --port $Port --workers $Workers
