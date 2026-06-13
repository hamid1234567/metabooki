param(
  [int]$IntervalSeconds = 20,
  [int]$QuietSeconds = 45,
  [switch]$Once
)

$ErrorActionPreference = 'Stop'
$env:GIT_TERMINAL_PROMPT = '0'
$repoRoot = Split-Path -Parent $PSScriptRoot
$git = 'C:\Program Files\Git\cmd\git.exe'

if (-not (Test-Path $git)) {
  $git = 'git'
}

Set-Location $repoRoot

function Get-MeaningfulStatus {
  $status = & $git status --porcelain --untracked-files=all
  return @($status | Where-Object {
    $_ -and
    $_ -notmatch 'public/version\.json$' -and
    $_ -notmatch '(^|[\\/])\.env(\.|$)' -and
    $_ -notmatch '(^|[\\/])dist[\\/]'
  })
}

function Update-AppVersion {
  $versionPath = Join-Path $repoRoot 'src\lib\version.ts'
  $content = Get-Content -LiteralPath $versionPath -Raw
  $match = [regex]::Match($content, "APP_VERSION\s*=\s*['""](\d+)\.(\d+)\.(\d+)['""]")
  if (-not $match.Success) { throw 'Could not read APP_VERSION.' }

  $nextVersion = "$($match.Groups[1].Value).$($match.Groups[2].Value).$([int]$match.Groups[3].Value + 1)"
  $updated = [regex]::Replace($content, "APP_VERSION\s*=\s*['""][^'""]+['""]", "APP_VERSION = '$nextVersion'", 1)
  [System.IO.File]::WriteAllText($versionPath, $updated, [System.Text.UTF8Encoding]::new($false))
  Write-Host "[Metabooki] Version bumped to $nextVersion." -ForegroundColor Cyan
}

function Publish-Changes {
  Write-Host "`n[Metabooki] Changes detected. Running production build..." -ForegroundColor Cyan
  Update-AppVersion
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) {
    Write-Host '[Metabooki] Build failed. Nothing was pushed.' -ForegroundColor Red
    return
  }

  & $git add -A -- .
  if ($LASTEXITCODE -ne 0) { throw 'Could not stage changes.' }

  $sensitive = @(& $git diff --cached --name-only | Where-Object {
    $_ -match '(^|/)\.env(\.|$)' -or
    $_ -match '(secret|service[_-]?role|private[_-]?key)' -or
    $_ -match '\.(pem|p12|pfx)$'
  })
  if ($sensitive.Count -gt 0) {
    & $git reset -- $sensitive
    Write-Host "[Metabooki] Sensitive-looking files were not committed: $($sensitive -join ', ')" -ForegroundColor Yellow
  }

  & $git diff --cached --quiet
  if ($LASTEXITCODE -eq 0) {
    Write-Host '[Metabooki] No publishable changes remain.' -ForegroundColor DarkGray
    return
  }

  $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm'
  & $git commit -m "Auto sync: $stamp"
  if ($LASTEXITCODE -ne 0) { throw 'Commit failed.' }

  & $git push origin main
  if ($LASTEXITCODE -ne 0) {
    Write-Host '[Metabooki] Push failed. The commit is safe locally; resolve the Git issue and push again.' -ForegroundColor Red
    return
  }

  Write-Host '[Metabooki] GitHub updated. GitHub Pages deployment has started.' -ForegroundColor Green
}

Write-Host '[Metabooki] Auto Sync is active. Press Ctrl+C to stop.' -ForegroundColor Green
Write-Host "[Metabooki] Checks every $IntervalSeconds seconds and publishes after $QuietSeconds quiet seconds." -ForegroundColor DarkGray

if ($Once) {
  if ((Get-MeaningfulStatus).Count -gt 0) {
    Publish-Changes
  } else {
    Write-Host '[Metabooki] Everything is already synced.' -ForegroundColor Green
  }
  exit
}

$lastSignature = ''
$changedAt = $null

while ($true) {
  $status = Get-MeaningfulStatus
  $signature = $status -join "`n"

  if ($signature -ne $lastSignature) {
    $lastSignature = $signature
    $changedAt = if ($status.Count -gt 0) { Get-Date } else { $null }
  }

  if ($changedAt -and ((Get-Date) - $changedAt).TotalSeconds -ge $QuietSeconds) {
    try {
      Publish-Changes
    } catch {
      Write-Host "[Metabooki] Sync error: $($_.Exception.Message)" -ForegroundColor Red
    }
    $lastSignature = (Get-MeaningfulStatus) -join "`n"
    $changedAt = $null
  }

  Start-Sleep -Seconds $IntervalSeconds
}
