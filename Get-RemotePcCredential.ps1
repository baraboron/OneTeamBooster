# Windows-only helper. No passwords are stored in this file or passed as arguments.
[CmdletBinding()]
param(
    [string]$Target = 'OneTeamBooster/remote/192.168.20.72/admin',
    [string]$UserName = 'admin',
    [switch]$Store,
    [switch]$Verify,
    [switch]$SshAskPass,
    [string]$PromptText
)

$ErrorActionPreference = 'Stop'
if (-not ('OtbRemote.CredentialStore' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Security;

namespace OtbRemote {
    public static class CredentialStore {
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        private struct Credential {
            public uint Flags;
            public uint Type;
            public string TargetName;
            public string Comment;
            public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
            public uint CredentialBlobSize;
            public IntPtr CredentialBlob;
            public uint Persist;
            public uint AttributeCount;
            public IntPtr Attributes;
            public string TargetAlias;
            public string UserName;
        }

        [DllImport("advapi32.dll", EntryPoint = "CredWriteW", CharSet = CharSet.Unicode, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool CredWrite(ref Credential credential, uint flags);
        [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool CredRead(string target, uint type, uint flags, out IntPtr credential);
        [DllImport("advapi32.dll")]
        private static extern void CredFree(IntPtr credential);

        public static void Save(string target, string user, SecureString password) {
            IntPtr blob = Marshal.SecureStringToCoTaskMemUnicode(password);
            try {
                var credential = new Credential {
                    Type = 1, TargetName = target, UserName = user,
                    Comment = "User-authorized remote PC credential; protocol not yet verified.",
                    CredentialBlob = blob, CredentialBlobSize = checked((uint)password.Length * 2),
                    Persist = 2
                };
                if (!CredWrite(ref credential, 0)) throw new Win32Exception(Marshal.GetLastWin32Error());
            } finally { Marshal.ZeroFreeCoTaskMemUnicode(blob); }
        }

        public static SecureString Read(string target, out string user) {
            IntPtr pointer;
            if (!CredRead(target, 1, 0, out pointer)) throw new Win32Exception(Marshal.GetLastWin32Error());
            try {
                var credential = (Credential)Marshal.PtrToStructure(pointer, typeof(Credential));
                user = credential.UserName;
                var secret = new SecureString();
                try {
                    for (int offset = 0; offset < credential.CredentialBlobSize; offset += 2)
                        secret.AppendChar((char)Marshal.ReadInt16(credential.CredentialBlob, offset));
                    secret.MakeReadOnly();
                    return secret;
                } catch { secret.Dispose(); throw; }
            } finally { CredFree(pointer); }
        }

        public static bool Equal(SecureString a, SecureString b) {
            if (a.Length != b.Length) return false;
            IntPtr pa = Marshal.SecureStringToCoTaskMemUnicode(a);
            IntPtr pb = IntPtr.Zero;
            try {
                pb = Marshal.SecureStringToCoTaskMemUnicode(b);
                int difference = 0;
                for (int i = 0; i < a.Length * 2; i++)
                    difference |= Marshal.ReadByte(pa, i) ^ Marshal.ReadByte(pb, i);
                return difference == 0;
            } finally {
                Marshal.ZeroFreeCoTaskMemUnicode(pa);
                if (pb != IntPtr.Zero) Marshal.ZeroFreeCoTaskMemUnicode(pb);
            }
        }
    }
}
'@
}

if ($Store) {
    $password = Read-Host 'Password (hidden)' -AsSecureString
    $savedPassword = $null
    try {
        if ($password.Length -eq 0) { throw 'An empty password will not be stored.' }
        [OtbRemote.CredentialStore]::Save($Target, $UserName, $password)
        $savedUser = ''
        $savedPassword = [OtbRemote.CredentialStore]::Read($Target, [ref]$savedUser)
        if ($savedUser -ne $UserName -or -not [OtbRemote.CredentialStore]::Equal($password, $savedPassword)) {
            throw 'Credential read-back verification failed.'
        }
        Write-Output 'Credential stored; read-back verification passed. Password not displayed.'
    } finally {
        $password.Dispose()
        if ($null -ne $savedPassword) { $savedPassword.Dispose() }
    }
} else {
    $savedUser = ''
    $password = [OtbRemote.CredentialStore]::Read($Target, [ref]$savedUser)
    if ($SshAskPass) {
        # Only the SSH child process may consume this stdout. Never invoke to inspect a password.
        if ($env:OTB_SSH_ASKPASS_ACTIVE -ne '1' -or $PromptText -notmatch '(?i)password:') {
            $password.Dispose()
            throw 'Password output is restricted to the SSH askpass process.'
        }
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToCoTaskMemUnicode($password)
        try { [Console]::Out.WriteLine([Runtime.InteropServices.Marshal]::PtrToStringUni($pointer)) }
        finally {
            [Runtime.InteropServices.Marshal]::ZeroFreeCoTaskMemUnicode($pointer)
            $password.Dispose()
        }
    } elseif ($Verify) {
        $password.Dispose()
        [pscustomobject]@{ Target = $Target; UserName = $savedUser; Readable = $true }
    } else {
        [System.Management.Automation.PSCredential]::new($savedUser, $password)
    }
}
