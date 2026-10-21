; Inno Setup 6 Script for Spark POS Desktop
; Supports Indonesian and English, Desktop Icon, Start Menu folder with both Spark POS and dedicated Uninstall shortcut.

#define MyAppName "Spark POS"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "SparkPOS Retail"
#define MyAppURL "https://github.com/sparkpos"
#define MyAppExeName "SparkPOS.exe"

[Setup]
AppId={{5F8A2D9E-4B3C-4D1E-8901-2C3D4E5F6A7B}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\SparkPOS
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=..\dist\installer
OutputBaseFilename=SparkPOS_Setup_v1.0.0
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName}

[Languages]
Name: "indonesian"; MessagesFile: "compiler:Languages\Indonesian.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "..\dist\portable\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
; 1. Shortcut Aplikasi Utama di Start Menu
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"
; 2. Shortcut Uninstall di Start Menu (Memenuhi instruksi: "setelah terinstall juga ada opsi uninstall apps nya di start")
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
; 3. Shortcut di Desktop Windows (Opsional dipilih kasir)
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
