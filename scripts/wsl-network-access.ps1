# Rekindle Docker Network Access Setup (WSL2)
# Run as Administrator so phones on the same network can reach the dev server.
#
# Docker Desktop on Windows only exposes ports to localhost by default.
# This script forwards your LAN IP ports to the Docker/WSL2 VM (portproxy + firewall).

# Get Docker Desktop VM IP (where containers actually run)
$ipOut = wsl -d docker-desktop ip -4 addr show eth0 2>$null
$DockerVmIp = $null
if ($ipOut) {
    $ipLine = $ipOut | Select-String 'inet '
    if ($ipLine -match 'inet\s+([\d.]+)') { $DockerVmIp = $Matches[1] }
}
if (-not $DockerVmIp) {
    Write-Host "Could not get Docker VM IP. Trying default WSL2..."
    $wslIps = (wsl hostname -I 2>$null).Trim().Split()
    foreach ($ip in $wslIps) {
        if ($ip -match '^\d+\.\d+\.\d+\.\d+$' -and $ip -notmatch '^172\.(1[7-9]|2[0-9]|3[0-1])\.') {
            $DockerVmIp = $ip
            break
        }
    }
}
if (-not $DockerVmIp) {
    Write-Error "Could not get WSL/Docker VM IP. Is Docker Desktop running?"
    exit 1
}

Write-Host "Docker/WSL2 VM IP: $DockerVmIp"
Write-Host "Setting up port forwarding 3000 (frontend), 8000 (backend) -> $DockerVmIp"
Write-Host ""

# Remove existing rules
netsh interface portproxy delete v4tov4 listenport=3000 listenaddress=0.0.0.0 2>$null
netsh interface portproxy delete v4tov4 listenport=8000 listenaddress=0.0.0.0 2>$null

# Add port forwarding
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=$DockerVmIp
netsh interface portproxy add v4tov4 listenport=8000 listenaddress=0.0.0.0 connectport=8000 connectaddress=$DockerVmIp

# Firewall rules
netsh advfirewall firewall delete rule name="Rekindle Dev 3000" 2>$null
netsh advfirewall firewall delete rule name="Rekindle Dev 8000" 2>$null
netsh advfirewall firewall add rule name="Rekindle Dev 3000" dir=in action=allow protocol=TCP localport=3000
netsh advfirewall firewall add rule name="Rekindle Dev 8000" dir=in action=allow protocol=TCP localport=8000

$HostIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -match 'Wi-Fi|Ethernet' -and $_.IPAddress -notmatch '^169\.' } | Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "Done! Mobile devices can access:"
Write-Host "  Frontend:  http://${HostIp}:3000" -ForegroundColor Green
Write-Host "  HTTPS (camera): https://${HostIp}:3000" -ForegroundColor Green
Write-Host "  Backend:   http://${HostIp}:8000" -ForegroundColor Green
Write-Host ""
Write-Host "Note: Run this script again if Docker Desktop restarts (VM IP may change)."
