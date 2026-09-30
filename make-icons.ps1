# Generates the Questbound app icons (home screen, manifest, favicon) from the painted map.
# Run: powershell -ExecutionPolicy Bypass -File make-icons.ps1
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$map = [System.Drawing.Image]::FromFile((Join-Path $root 'assets\map\crossroads-landscape.png'))
function New-Icon([int]$size, [string]$path, [bool]$maskable) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'; $g.InterpolationMode = 'HighQualityBicubic'; $g.TextRenderingHint = 'AntiAliasGridFit'
  # Painted landscape (the inn and road), darkened with a candle-glow vignette.
  $src = New-Object System.Drawing.Rectangle 0, ([Math]::Max(0, $map.Height - 840)), 820, 820
  $g.DrawImage($map, (New-Object System.Drawing.Rectangle 0, 0, $size, $size), $src, 'Pixel')
  $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(170, 6, 8, 12))), 0, 0, $size, $size)
  $glow = New-Object System.Drawing.Drawing2D.GraphicsPath; $glow.AddEllipse(-$size * 0.25, -$size * 0.25, $size * 1.5, $size * 1.5)
  $vb = New-Object System.Drawing.Drawing2D.PathGradientBrush $glow
  $vb.CenterColor = [System.Drawing.Color]::FromArgb(40, 236, 164, 84); $vb.SurroundColors = @([System.Drawing.Color]::FromArgb(235, 4, 5, 8))
  $g.FillRectangle($vb, 0, 0, $size, $size)
  $inset = if ($maskable) { 0.2 } else { 0.1 }
  $gold = [System.Drawing.Color]::FromArgb(232, 199, 123); $goldDeep = [System.Drawing.Color]::FromArgb(168, 120, 50)
  # Double gold ring.
  $r1 = $size * $inset; $d1 = $size - 2 * $r1
  $g.DrawEllipse((New-Object System.Drawing.Pen $gold, ([single]($size * 0.018))), [single]$r1, [single]$r1, [single]$d1, [single]$d1)
  $r2 = $r1 + $size * 0.035; $d2 = $size - 2 * $r2
  $g.DrawEllipse((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(150, 201, 164, 92)), ([single]($size * 0.006))), [single]$r2, [single]$r2, [single]$d2, [single]$d2)
  # Gilded Q monogram with a dark engraved shadow.
  $font = New-Object System.Drawing.Font 'Georgia', ([single]($size * (0.58 - $inset))), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $fmt = New-Object System.Drawing.StringFormat; $fmt.Alignment = 'Center'; $fmt.LineAlignment = 'Center'
  $box = New-Object System.Drawing.RectangleF 0, ([single](-$size * 0.02)), $size, $size
  $path2 = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path2.AddString('Q', $font.FontFamily, [int]$font.Style, $font.Size, $box, $fmt)
  $shadow = $path2.Clone(); $m = New-Object System.Drawing.Drawing2D.Matrix; $m.Translate(0, $size * 0.012); $shadow.Transform($m)
  $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 20, 12, 4))), $shadow)
  $gb = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.PointF 0, ($size * 0.22)), (New-Object System.Drawing.PointF 0, ($size * 0.8)), ([System.Drawing.Color]::FromArgb(255, 248, 226)), $goldDeep
  $blend = New-Object System.Drawing.Drawing2D.ColorBlend 4
  $blend.Colors = @([System.Drawing.Color]::FromArgb(255, 248, 226), [System.Drawing.Color]::FromArgb(245, 220, 156), [System.Drawing.Color]::FromArgb(200, 150, 66), [System.Drawing.Color]::FromArgb(243, 214, 143))
  $blend.Positions = @([single]0, [single]0.4, [single]0.7, [single]1)
  $gb.InterpolationColors = $blend
  $g.FillPath($gb, $path2)
  $g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(160, 90, 60, 20)), ([single]([Math]::Max(1, $size * 0.004)))), $path2)
  New-Item -ItemType Directory -Force (Split-Path $path) | Out-Null
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
New-Icon 1024 (Join-Path $root 'assets\questbound-icon.png') $false
New-Icon 512 (Join-Path $root 'public\icons\icon-512.png') $false
New-Icon 192 (Join-Path $root 'public\icons\icon-192.png') $false
New-Icon 512 (Join-Path $root 'public\icons\maskable-512.png') $true
New-Icon 180 (Join-Path $root 'public\icons\apple-touch-icon.png') $false
New-Icon 48 (Join-Path $root 'assets\questbound-favicon.png') $false
$map.Dispose()
Write-Host 'Icons written.'
