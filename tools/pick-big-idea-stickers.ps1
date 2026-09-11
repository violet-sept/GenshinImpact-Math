param(
  [Parameter(Mandatory=$true)][string]$Src,
  [Parameter(Mandatory=$true)][string]$Out,
  [string]$Sheet = '',
  [int]$Seed = 20260911,
  [int]$MaxH = 96
)

$ErrorActionPreference = 'Stop'
trap {
  Write-Host ("TRAP {0}: {1}" -f $_.Exception.GetType().Name, $_.Exception.Message)
  Write-Host ("  line {0}: {1}" -f $_.InvocationInfo.ScriptLineNumber, $_.InvocationInfo.Line.Trim())
  exit 1
}
Add-Type -AssemblyName System.Drawing

# 知识点 id，按目录顺序（L1..B1），与随机抽中的表情包一一对应
$IDS = @('L1','L2','L3','S1','S2','S4','S7','R1','R2','C1','C2','C4','C5','G1','G2','G3','G5','G6','G7','T2','B1')

$ALPHA_MIN = 8
$CONNECT_MIN = 238
$FMIN = 242

# ---------------------------------------------------------------- 边框分类
function Get-BorderKind {
  param([System.Drawing.Bitmap]$bmp)
  $w = $bmp.Width; $h = $bmp.Height
  $sx = [Math]::Max(1, [int]($w / 40)); $sy = [Math]::Max(1, [int]($h / 40))
  $trans = 0; $white = 0; $other = 0; $semi = 0; $n = 0
  $xs = @(); for ($x = 0; $x -lt $w; $x += $sx) { $xs += $x }
  $ys = @(); for ($y = 0; $y -lt $h; $y += $sy) { $ys += $y }
  $pts = New-Object System.Collections.Generic.List[object]
  foreach ($x in $xs) { $pts.Add(@($x, 0)); $pts.Add(@($x, ($h - 1))) }
  foreach ($y in $ys) { $pts.Add(@(0, $y)); $pts.Add(@(($w - 1), $y)) }
  foreach ($p in $pts) {
    $c = $bmp.GetPixel($p[0], $p[1])
    $n++
    if ($c.A -le $ALPHA_MIN) { $trans++ }
    elseif ($c.A -lt 250) { $semi++ }
    else {
      $mc = [Math]::Min($c.R, [Math]::Min($c.G, $c.B))
      if ($mc -ge $CONNECT_MIN) { $white++ } else { $other++ }
    }
  }
  if (($other / $n) -gt 0.10) { return 'Colored' }
  if (($white / $n) -ge 0.55) { return 'WhiteKey' }
  if ((($trans + $semi) / $n) -ge 0.85) { return 'Alpha' }
  return 'Mixed'
}

# ------------------------------------------------- 白底抠除：从图像边框向内泛洪
function Remove-White {
  param([System.Drawing.Bitmap]$bmp)
  $w = $bmp.Width; $h = $bmp.Height
  $rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
  $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $stride = $data.Stride
  $bytes = New-Object byte[] ($stride * $h)
  [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)

  $seen = New-Object bool[] ($w * $h)
  $stack = New-Object 'System.Collections.Generic.Stack[int]'
  $seed = {
    param($x, $y)
    $o = $y * $stride + $x * 4
    if ($bytes[$o + 3] -lt 250) { return }
    $mc = [Math]::Min($bytes[$o], [Math]::Min($bytes[$o + 1], $bytes[$o + 2]))
    if ($mc -ge $CONNECT_MIN) { $stack.Push($y * $w + $x) }
  }
  for ($x = 0; $x -lt $w; $x++) { & $seed $x 0; & $seed $x ($h - 1) }
  for ($y = 0; $y -lt $h; $y++) { & $seed 0 $y; & $seed ($w - 1) $y }

  while ($stack.Count -gt 0) {
    $idx = $stack.Pop()
    if ($seen[$idx]) { continue }
    $seen[$idx] = $true
    $x = $idx % $w; $y = [int](($idx - $x) / $w)
    $o = $y * $stride + $x * 4
    $b = [int]$bytes[$o]; $g = [int]$bytes[$o + 1]; $r = [int]$bytes[$o + 2]
    $mc = [Math]::Min($b, [Math]::Min($g, $r))
    $a = (255.0 - $mc) / (255.0 - $FMIN)
    if ($a -lt 0) { $a = 0 } elseif ($a -gt 1) { $a = 1 }
    if ($a -le 0.004) {
      $bytes[$o] = $FMIN; $bytes[$o + 1] = $FMIN; $bytes[$o + 2] = $FMIN; $bytes[$o + 3] = 0
    } else {
      $nr = [int][Math]::Round(($r - (1 - $a) * 255.0) / $a)
      $ng = [int][Math]::Round(($g - (1 - $a) * 255.0) / $a)
      $nb = [int][Math]::Round(($b - (1 - $a) * 255.0) / $a)
      if ($nr -lt 0) { $nr = 0 } elseif ($nr -gt 255) { $nr = 255 }
      if ($ng -lt 0) { $ng = 0 } elseif ($ng -gt 255) { $ng = 255 }
      if ($nb -lt 0) { $nb = 0 } elseif ($nb -gt 255) { $nb = 255 }
      $bytes[$o] = [byte]$nb; $bytes[$o + 1] = [byte]$ng; $bytes[$o + 2] = [byte]$nr
      $bytes[$o + 3] = [byte][Math]::Round($a * 255.0)
    }
    foreach ($d in @(@(0,-1), @(0,1), @(-1,0), @(1,0))) {
      $nx = $x + $d[0]; $ny = $y + $d[1]
      if ($nx -lt 0 -or $ny -lt 0 -or $nx -ge $w -or $ny -ge $h) { continue }
      if ($seen[$ny * $w + $nx]) { continue }
      $no = $ny * $stride + $nx * 4
      if ($bytes[$no + 3] -lt 250) { continue }
      $nmin = [Math]::Min($bytes[$no], [Math]::Min($bytes[$no + 1], $bytes[$no + 2]))
      if ($nmin -ge $CONNECT_MIN) { $stack.Push($ny * $w + $nx) }
    }
  }
  [System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $data.Scan0, $bytes.Length)
  $bmp.UnlockBits($data)
}

# ------------------------------------------- 单张处理：裁到内容边界 + 缩放到 MaxH
function Convert-One {
  param([string]$Path, [int]$MaxH, [bool]$KeyWhite)
  $img = [System.Drawing.Image]::FromFile($Path)
  try {
    $w = $img.Width; $h = $img.Height
    $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $gg = [System.Drawing.Graphics]::FromImage($bmp)
    $gg.DrawImage($img, 0, 0, $w, $h)
    $gg.Dispose()
  } finally { $img.Dispose() }

  if ($KeyWhite) { Remove-White $bmp }

  $rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
  $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $stride = $data.Stride
  $bytes = New-Object byte[] ($stride * $h)
  [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
  $bmp.UnlockBits($data)

  $minX = $w; $minY = $h; $maxX = -1; $maxY = -1; $solid = 0
  for ($y = 0; $y -lt $h; $y++) {
    $row = $y * $stride
    for ($x = 0; $x -lt $w; $x++) {
      if ($bytes[$row + $x * 4 + 3] -gt $ALPHA_MIN) {
        $solid++
        if ($x -lt $minX) { $minX = $x }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
  if ($maxX -lt 0) { $bmp.Dispose(); return $null }
  $bw = $maxX - $minX + 1; $bh = $maxY - $minY + 1
  $cov = ($bw * $bh) / [double]($w * $h)
  $solidRatio = $solid / [double]($w * $h)
  $aspect = $bw / [double]$bh

  $why = ''
  if ($cov -lt 0.18) { $why = 'cov' }
  elseif ($solidRatio -lt 0.04) { $why = 'solid' }
  elseif ($aspect -lt 0.4 -or $aspect -gt 2.6) { $why = 'aspect' }
  elseif ($bh -lt 48) { $why = 'small' }
  if ($why -ne '') {
    $bmp.Dispose()
    return [pscustomobject]@{ Ok = $false; Why = $why }
  }

  $scale = [Math]::Min($MaxH / [double]$bh, ($MaxH * 1.7) / [double]$bw)
  if ($scale -gt 1) { $scale = 1 }
  $nw = [Math]::Max(1, [int][Math]::Round($bw * $scale))
  $nh = [Math]::Max(1, [int][Math]::Round($bh * $scale))
  $dst = New-Object System.Drawing.Bitmap($nw, $nh, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $dg = [System.Drawing.Graphics]::FromImage($dst)
  $dg.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $dg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $dg.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $dg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $dg.DrawImage($bmp, (New-Object System.Drawing.Rectangle(0, 0, $nw, $nh)), (New-Object System.Drawing.Rectangle($minX, $minY, $bw, $bh)), [System.Drawing.GraphicsUnit]::Pixel)
  $dg.Dispose()
  $bmp.Dispose()
  return [pscustomobject]@{ Ok = $true; Bmp = $dst }
}

# ------------------------------------------------------------------ 1. 分类
$files = @(Get-ChildItem -LiteralPath $Src -Filter *.png -File | Sort-Object Name)
$alpha = New-Object System.Collections.Generic.List[object]
$whiteKey = New-Object System.Collections.Generic.List[object]
$other = 0; $bad = 0
foreach ($f in $files) {
  try {
    $b = New-Object System.Drawing.Bitmap($f.FullName)
    $kind = Get-BorderKind $b
    $b.Dispose()
  } catch {
    $bad++
    if ($bad -le 3) {
      Write-Host ("ERR {0}: {1}" -f $f.Name, $_.Exception.Message)
      Write-Host $_.InvocationInfo.PositionMessage
    }
    continue
  }
  if ($kind -eq 'Alpha') { $alpha.Add($f) }
  elseif ($kind -eq 'WhiteKey') { $whiteKey.Add($f) }
  else { $other++ }
}
Write-Host ("pool: alpha={0} whitekey={1} skipped={2} unreadable={3}" -f $alpha.Count, $whiteKey.Count, $other, $bad)

# ------------------------------------------------------------------ 2. 洗牌
$rng = New-Object System.Random($Seed)
function Shuffle-List {
  param($list)
  $a = $list.ToArray()
  for ($i = $a.Count - 1; $i -gt 0; $i--) {
    $j = $rng.Next($i + 1)
    $t = $a[$i]; $a[$i] = $a[$j]; $a[$j] = $t
  }
  return $a
}
$queue = @()
$queue += Shuffle-List $alpha
$queue += Shuffle-List $whiteKey
Write-Host ("queue: {0}" -f $queue.Count)

# ------------------------------------------------------- 3. 依次取用直到凑齐
if (-not (Test-Path -LiteralPath $Out)) { New-Item -ItemType Directory -Force -Path $Out | Out-Null }
$manifest = New-Object System.Collections.Generic.List[object]
$qi = 0
foreach ($id in $IDS) {
  $done = $false
  while (-not $done) {
    if ($qi -ge $queue.Count) { throw "run out of candidates at $id" }
    $f = $queue[$qi]; $qi++
    $kind = if ($alpha.Contains($f)) { 'alpha' } else { 'whitekey' }
    $r = Convert-One $f.FullName $MaxH ($kind -eq 'whitekey')
    if ($null -eq $r) { continue }
    if (-not $r.Ok) { Write-Host ("  reject [{0}] {1}" -f $r.Why, $f.Name); continue }
    $outPath = Join-Path $Out ($id + '.png')
    $r.Bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $r.Bmp.Dispose()
    $len = (Get-Item -LiteralPath $outPath).Length
    $manifest.Add([pscustomobject]@{ Id = $id; Src = $f.Name; Kind = $kind; Bytes = $len })
    Write-Host ("{0} <- {1}  ({2}, {3} B)" -f $id, $f.Name, $kind, $len)
    $done = $true
  }
}

# ------------------------------------------------------------------ 4. 拼版预览
if ($Sheet -ne '') {
  $cols = 4
  $rows = [int][Math]::Ceiling($IDS.Count / [double]$cols)
  $cw = 320; $ch = 170
  $canvas = New-Object System.Drawing.Bitmap(($cw * $cols), ($ch * $rows), [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($canvas)
  $g.Clear([System.Drawing.Color]::White)
  $bgs = @(
    [System.Drawing.Color]::FromArgb(255, 255, 255),
    [System.Drawing.Color]::FromArgb(30, 41, 59),
    [System.Drawing.Color]::FromArgb(241, 245, 249)
  )
  $font = New-Object System.Drawing.Font('Microsoft YaHei', 10)
  $i = 0
  foreach ($m in $manifest) {
    $cx = ($i % $cols) * $cw; $cy = [int][Math]::Floor($i / $cols) * $ch
    $bg = $bgs[$i % $bgs.Count]
    $g.FillRectangle((New-Object System.Drawing.SolidBrush($bg)), $cx, $cy, $cw, $ch)
    $ink = if ($bg.R -lt 128) { [System.Drawing.Color]::FromArgb(226, 232, 240) } else { [System.Drawing.Color]::FromArgb(15, 23, 42) }
    $brush = New-Object System.Drawing.SolidBrush($ink)
    $g.DrawString(("{0}   {1}" -f $m.Id, $m.Src), $font, $brush, ($cx + 8), ($cy + 6))
    $img = [System.Drawing.Image]::FromFile((Join-Path $Out ($m.Id + '.png')))
    $g.DrawImage($img, ($cx + 8), ($cy + 34), $img.Width, $img.Height)
    $g.DrawString(("{0}x{1} {2}B" -f $img.Width, $img.Height, $m.Bytes), $font, $brush, ($cx + 8), ($cy + $ch - 24))
    $img.Dispose()
    $brush.Dispose()
    $i++
  }
  $g.Dispose()
  $canvas.Save($Sheet, [System.Drawing.Imaging.ImageFormat]::Png)
  $canvas.Dispose()
  Write-Host "sheet: $Sheet"
}

Write-Host '--- manifest ---'
$manifest | ForEach-Object { Write-Host ("{0}`t{1}`t{2}`t{3}" -f $_.Id, $_.Src, $_.Kind, $_.Bytes) }
Write-Host ("total bytes: {0}" -f ($manifest | Measure-Object -Property Bytes -Sum).Sum)
