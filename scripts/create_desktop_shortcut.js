// Create Windows Desktop Shortcut for Sree Sai Fillings POS
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectDir = path.resolve(__dirname, '..');
const electronExe = path.join(projectDir, 'node_modules', 'electron', 'dist', 'electron.exe');
const iconPath = path.join(projectDir, 'assets', 'icon.png');

const homeDir = process.env.USERPROFILE || 'C:\\Users\\Hp';
const oneDriveDesktop = path.join(homeDir, 'OneDrive', 'Desktop');
const localDesktop = path.join(homeDir, 'Desktop');

const vbsScript = `
Set WshShell = CreateObject("WScript.Shell")

Sub MakeShortcut(folderPath)
  Dim fso
  Set fso = CreateObject("Scripting.FileSystemObject")
  If fso.FolderExists(folderPath) Then
    Dim lnkPath, sc
    lnkPath = folderPath & "\\Sree Sai Fillings POS.lnk"
    Set sc = WshShell.CreateShortcut(lnkPath)
    sc.TargetPath = "${electronExe.replace(/\\/g, '\\\\')}"
    sc.Arguments = """${projectDir.replace(/\\/g, '\\\\')}"""
    sc.WorkingDirectory = "${projectDir.replace(/\\/g, '\\\\')}"
    sc.Description = "Sree Sai Fillings Cafe - POS Software"
    sc.Save
    WScript.Echo "Created shortcut at: " & lnkPath
  End If
End Sub

MakeShortcut "${oneDriveDesktop.replace(/\\/g, '\\\\')}"
MakeShortcut "${localDesktop.replace(/\\/g, '\\\\')}"
MakeShortcut "${projectDir.replace(/\\/g, '\\\\')}"
`;

const vbsPath = path.join(__dirname, 'create_shortcut.vbs');
fs.writeFileSync(vbsPath, vbsScript);

try {
  const out = execSync(`cscript //nologo "${vbsPath}"`);
  console.log(out.toString());
} catch (e) {
  console.error('Error creating shortcut:', e.message);
}
