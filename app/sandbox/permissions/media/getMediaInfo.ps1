Add-Type -AssemblyName System.Runtime.WindowsRuntime

[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionPlaybackStatus, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]

function Await($WinRtTask, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.GetAwaiter().GetResult()
}

$mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
$session = $mgr.GetCurrentSession()

if ($session) {
    $props = Await ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
    $playback = $session.GetPlaybackInfo()
    $timeline = $session.GetTimelineProperties()

    $status = "Unknown"
    if ($playback.PlaybackStatus -eq [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionPlaybackStatus]::Playing) {
        $status = "Playing"
    } elseif ($playback.PlaybackStatus -eq [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionPlaybackStatus]::Paused) {
        $status = "Paused"
    }

    $obj = [ordered]@{
        Title = $props.Title
        Artist = $props.Artist
        AlbumTitle = $props.AlbumTitle
        Status = $status
        Duration = if ($timeline.EndTime.TotalSeconds -gt 0) { [math]::Round($timeline.EndTime.TotalSeconds) } else { 0 }
        Position = [math]::Round($timeline.Position.TotalSeconds)
    }
    $obj | ConvertTo-Json -Compress
} else {
    Write-Output '{"Title":"","Artist":"","AlbumTitle":"","Status":"None","Duration":0,"Position":0}'
}
