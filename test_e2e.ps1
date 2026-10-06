param([switch]$UnitOnly)
$ErrorActionPreference = 'Stop'
$backendPath = Join-Path $PSScriptRoot 'apps\backend'
Push-Location -LiteralPath $backendPath
try {
    Write-Host 'Running Auth, Excel parser and Google identity unit tests...'
    npm.cmd test
    if ($LASTEXITCODE -ne 0) { throw 'Unit tests failed.' }
    if (-not $UnitOnly) {
        Write-Host 'Running integration tests on dedicated PostgreSQL test database and Redis...'
        npm.cmd run test:integration
        if ($LASTEXITCODE -ne 0) { throw 'Integration tests failed.' }
    }
    Write-Host 'Milestone 2 checks passed.'
} finally {
    Pop-Location
}