$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$buildDir = Join-Path $projectRoot 'build'
$outputPath = Join-Path $buildDir 'icon.ico'
New-Item -ItemType Directory -Force -Path $buildDir | Out-Null

$size = 256
$bitmap = New-Object System.Drawing.Bitmap $size, $size
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::Transparent)

$background = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 24, 32, 56))
$accent = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 112, 184, 255))
$face = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 238, 246, 255))
$hand = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 24, 32, 56)), 14
$ring = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 112, 184, 255)), 12

$graphics.FillEllipse($background, 8, 8, 240, 240)
$graphics.FillEllipse($accent, 28, 28, 200, 200)
$graphics.FillEllipse($face, 48, 48, 160, 160)
$graphics.DrawEllipse($ring, 48, 48, 160, 160)
$graphics.DrawLine($hand, 128, 128, 128, 80)
$graphics.DrawLine($hand, 128, 128, 168, 152)
$graphics.FillEllipse($background, 116, 116, 24, 24)

$iconHandle = $bitmap.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($iconHandle)
$stream = [System.IO.File]::Open($outputPath, [System.IO.FileMode]::Create)

try {
  $icon.Save($stream)
} finally {
  $stream.Dispose()
  $icon.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

Write-Host "Generated $outputPath"
