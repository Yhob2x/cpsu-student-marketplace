# Original CPSU Student Marketplace icon; no university seal or external image assets.
# Regenerate icons from PowerShell on Windows: powershell -File scripts/generate-pwa-icons.ps1
param([string]$OutputDirectory = (Join-Path $PSScriptRoot '..\apps\web\public\icons'))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$directory = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $directory | Out-Null

function New-MarketplaceIcon([int]$size, [string]$filename, [bool]$maskable) {
  $bmp = [System.Drawing.Bitmap]::new($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bmp)
  $cream = [System.Drawing.ColorTranslator]::FromHtml('#F5F3E9')
  $forest = [System.Drawing.ColorTranslator]::FromHtml('#073B2A')
  $gold = [System.Drawing.ColorTranslator]::FromHtml('#E0BB46')
  $pen = [System.Drawing.Pen]::new($cream, 53)
  $sparkle = [System.Drawing.SolidBrush]::new($gold)
  try {
    $graphics.Clear($forest)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.ScaleTransform([float]($size / 512), [float]($size / 512))
    # Maskable art stays inside the center 80%; non-maskable art fills more space.
    if (-not $maskable) {
      $graphics.TranslateTransform(256, 256)
      $graphics.ScaleTransform(1.075, 1.075)
      $graphics.TranslateTransform(-256, -256)
    }
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $graphics.DrawArc($pen, 146, 146, 220, 220, -45, -270)
    $coords = @(
      @(370,229),@(378,247),@(396,255),@(378,263),
      @(370,281),@(362,263),@(344,255),@(362,247)
    )
    $points = [System.Drawing.PointF[]]@($coords | ForEach-Object {
      [System.Drawing.PointF]::new([float]$_[0], [float]$_[1])
    })
    $graphics.FillPolygon($sparkle, $points)
    $bmp.Save((Join-Path $directory $filename), [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output "$filename : $size x $size"
  } finally {
    $sparkle.Dispose()
    $pen.Dispose()
    $graphics.Dispose()
    $bmp.Dispose()
  }
}
New-MarketplaceIcon 192 'icon-192.png' $false
New-MarketplaceIcon 512 'icon-512.png' $false
New-MarketplaceIcon 192 'icon-maskable-192.png' $true
New-MarketplaceIcon 512 'icon-maskable-512.png' $true
New-MarketplaceIcon 180 'apple-touch-icon.png' $true
