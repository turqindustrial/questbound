# Generates the Questbound app icons (home screen, manifest, favicon): a crimson Q in a red ring over the
# title painting, darkened, in the game's colours (dark red on black with a violet glow).
# Run: powershell -ExecutionPolicy Bypass -File make-icons.ps1
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$art = [System.Drawing.Image]::FromFile((Join-Path $root 'assets\title\questbound-title-tall.jpg'))
function New-Icon([int]$size, [string]$path, [bool]$maskable) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'; $g.InterpolationMode = 'HighQualityBicubic'; $g.TextRenderingHint = 'AntiAliasGridFit'
  # The middle of the painting (where the spells collide), darkened, with a violet glow behind the letter.
  $src = New-Object System.Drawing.Rectangle 162, 430, 700, 700
  $g.DrawImage($art, (New-Object System.Drawing.Rectangle 0, 0, $size, $size), $src, 'Pixel')
  $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(188, 8, 6, 10))), 0, 0, $size, $size)
  $glow = New-Object System.Drawing.Drawing2D.GraphicsPath; $glow.AddEllipse(-$size * 0.25, -$size * 0.25, $size * 1.5, $size * 1.5)
  $vb = New-Object System.Drawing.Drawing2D.PathGradientBrush $glow
  $vb.CenterColor = [System.Drawing.Color]::FromArgb(70, 140, 82, 255); $vb.SurroundColors = @([System.Drawing.Color]::FromArgb(238, 6, 4, 8))
  $g.FillRectangle($vb, 0, 0, $size, $size)
  $inset = if ($maskable) { 0.2 } else { 0.1 }
  $red = [System.Drawing.Color]::FromArgb(224, 74, 92); $redDeep = [System.Drawing.Color]::FromArgb(163, 22, 44)
  # Double ring: red outside, violet inside.
  $r1 = $size * $inset; $d1 = $size - 2 * $r1
  $g.DrawEllipse((New-Object System.Drawing.Pen $red, ([single]($size * 0.018))), [single]$r1, [single]$r1, [single]$d1, [single]$d1)
  $r2 = $r1 + $size * 0.035; $d2 = $size - 2 * $r2
  $g.DrawEllipse((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(170, 176, 140, 245)), ([single]($size * 0.006))), [single]$r2, [single]$r2, [single]$d2, [single]$d2)
  # Crimson Q monogram with a dark engraved shadow.
  $font = New-Object System.Drawing.Font 'Georgia', ([single]($size * (0.58 - $inset))), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $fmt = New-Object System.Drawing.StringFormat; $fmt.Alignment = 'Center'; $fmt.LineAlignment = 'Center'
  $box = New-Object System.Drawing.RectangleF 0, ([single](-$size * 0.02)), $size, $size
  $path2 = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path2.AddString('Q', $font.FontFamily, [int]$font.Style, $font.Size, $box, $fmt)
  $shadow = $path2.Clone(); $m = New-Object System.Drawing.Drawing2D.Matrix; $m.Translate(0, $size * 0.012); $shadow.Transform($m)
  $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(230, 20, 4, 7))), $shadow)
  $gb = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.PointF 0, ($size * 0.22)), (New-Object System.Drawing.PointF 0, ($size * 0.8)), ([System.Drawing.Color]::FromArgb(255, 225, 229)), $redDeep
  $blend = New-Object System.Drawing.Drawing2D.ColorBlend 4
  $blend.Colors = @([System.Drawing.Color]::FromArgb(255, 225, 229), [System.Drawing.Color]::FromArgb(255, 90, 114), [System.Drawing.Color]::FromArgb(163, 22, 44), [System.Drawing.Color]::FromArgb(226, 58, 85))
  $blend.Positions = @([single]0, [single]0.4, [single]0.7, [single]1)
  $gb.InterpolationColors = $blend
  $g.FillPath($gb, $path2)
  $g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(170, 60, 8, 18)), ([single]([Math]::Max(1, $size * 0.004)))), $path2)
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
$art.Dispose()
Write-Host 'Icons written.'
