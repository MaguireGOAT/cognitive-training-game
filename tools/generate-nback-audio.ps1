param(
    [ValidateSet(8000, 11025, 16000, 22050)]
    [int]$SampleRate = 16000
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dataPath = Join-Path $root 'js\food\data.js'
$outputDir = Join-Path $root 'assets\audio\nback'
$manifestPath = Join-Path $root 'js\food\nback-audio-map.js'

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$text = [System.IO.File]::ReadAllText($dataPath, [System.Text.Encoding]::UTF8)
$pattern = "name:\s*'(?<name>[^']+)'(?:\s*,\s*id:\s*'(?<id>[^']+)')?"
$matches = [regex]::Matches($text, $pattern, [System.Text.RegularExpressions.RegexOptions]::Singleline)

if ($matches.Count -lt 1) {
    throw 'No food names found in js/food/data.js.'
}

$items = @()
$seen = @{}
$index = 0
foreach ($match in $matches) {
    $name = $match.Groups['name'].Value
    $id = if ($match.Groups['id'].Success) { $match.Groups['id'].Value } else { $name }
    if ($seen.ContainsKey($id)) {
        throw "Duplicate food id: $id"
    }
    $seen[$id] = $true
    $items += [PSCustomObject]@{
        Index = $index
        Name = $name
        Id = $id
    }
    $index++
}

Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    $synth.SelectVoice('Microsoft Tracy Desktop')
} catch {
    throw 'Microsoft Tracy Desktop (zh-HK) is not available for text-to-speech.'
}

$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(
    $SampleRate,
    [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,
    [System.Speech.AudioFormat.AudioChannel]::Mono
)

foreach ($item in $items) {
    $file = Join-Path $outputDir ('{0:D3}.wav' -f $item.Index)
    $synth.SetOutputToWaveFile($file, $format)
    $synth.Speak($item.Name)
}
$synth.Dispose()

$manifestLines = New-Object 'System.Collections.Generic.List[string]'
$manifestLines.Add('        // Generated Cantonese audio map for N-back modalities.')
$manifestLines.Add('        const NBACK_AUDIO_MAP = {')
foreach ($item in $items) {
    $key = $item.Id.Replace("'", "\'")
    $path = 'assets/audio/nback/{0:D3}.wav' -f $item.Index
    $manifestLines.Add("            '$key': '$path',")
}
$manifestLines.Add('        };')
$manifestLines.Add('        window.CognitiveNbackAudioMap = NBACK_AUDIO_MAP;')

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$manifest = ($manifestLines -join "`n") + "`n"
[System.IO.File]::WriteAllText($manifestPath, $manifest, $utf8NoBom)

Write-Output "Generated $($items.Count) Cantonese audio files and $manifestPath"
