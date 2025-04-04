# Install nvm-windows
$nvmUrl = "https://github.com/coreybutler/nvm-windows/releases/download/1.1.12/nvm-setup.exe"
$nvmInstaller = "$env:TEMP\nvm-setup.exe"

Write-Host "Downloading nvm-windows..."
Invoke-WebRequest -Uri $nvmUrl -OutFile $nvmInstaller

Write-Host "Installing nvm-windows..."
Start-Process -FilePath $nvmInstaller -ArgumentList "/SILENT" -Wait

# Reload PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

Write-Host "Installing Node.js 18.17.0..."
nvm install 18.17.0
nvm use 18.17.0

Write-Host "Installing n8n..."
npm install -g n8n

Write-Host "Installing project dependencies..."
npm install

Write-Host "Starting n8n in a new window..."
Start-Process powershell -ArgumentList "n8n start"

Write-Host "Waiting for n8n to start..."
Start-Sleep -Seconds 10

Write-Host "Running check-n8n script..."
node check-n8n.js

Write-Host "Starting development server..."
npm run dev