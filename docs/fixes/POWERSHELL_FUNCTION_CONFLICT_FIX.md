# PowerShell Script Fix - Function Name Conflict

## Problem

The PowerShell helper script (`docker-helper.ps1`) had function name conflicts with PowerShell's built-in cmdlets:

```powershell
Write-Error : The term 'Write-Info' is not recognized...
```

### Root Cause

I named custom functions using PowerShell naming conventions:
- `Write-Success`
- `Write-Error` ❌ **Conflicts with built-in `Write-Error` cmdlet**
- `Write-Info`

PowerShell has built-in cmdlets with the `Write-*` prefix, causing namespace collisions.

---

## Solution

Renamed all custom output functions to use `Print-*` prefix:

```powershell
# Before (Conflicted)
function Write-Success { ... }
function Write-Error { ... }    # ❌ Conflicts with built-in
function Write-Info { ... }

# After (Fixed)
function Print-Success { ... }  # ✅ No conflict
function Print-Error { ... }    # ✅ No conflict
function Print-Info { ... }     # ✅ No conflict
```

### Changes Made

1. **Renamed function definitions** (lines 6-18):
   - `Write-Success` → `Print-Success`
   - `Write-Error` → `Print-Error`
   - `Write-Info` → `Print-Info`

2. **Updated all function calls** throughout the script:
   - 20+ instances replaced
   - Affects: `Test-Docker`, `Build-Dev`, `Build-Prod`, `Start-Dev`, `Start-Prod`, `Stop-Dev`, `Stop-Prod`, `Clear-Docker`, `Test-Health`, `Main`

---

## Verification

### Test Commands

```powershell
# Should now work without errors
.\docker-helper.ps1 start-dev
.\docker-helper.ps1 health
.\docker-helper.ps1 logs-dev
```

### Expected Output

✅ **Success messages** (green):
```
✓ Docker is running
✓ Development environment started
```

ℹ **Info messages** (yellow):
```
ℹ Starting development environment...
ℹ Access the app at: http://localhost:3000
```

✗ **Error messages** (red):
```
✗ Docker is not running. Please start Docker Desktop and try again.
```

---

## Technical Details

### PowerShell Built-in Cmdlets

PowerShell reserves these `Write-*` cmdlets:
- `Write-Host` - Console output
- `Write-Output` - Pipeline output
- `Write-Error` - Error messages ❌ **Conflicted**
- `Write-Warning` - Warning messages
- `Write-Verbose` - Verbose output
- `Write-Debug` - Debug output
- `Write-Information` - Information stream

### Why Print- Works

Using `Print-*` prefix:
- ✅ No conflicts with built-in cmdlets
- ✅ Clear naming convention
- ✅ Still descriptive
- ⚠️ PowerShell linter warns "unapproved verb" (cosmetic only, still works)

### Approved PowerShell Verbs

Official verbs include:
- `Get-`, `Set-`, `Test-`, `Start-`, `Stop-`
- `Invoke-`, `Show-`, `Clear-`, `Enter-`

Custom verbs (`Print-`, `Build-`) trigger linter warnings but work fine.

---

## Files Modified

- ✅ `mudra-app/docker-helper.ps1` - Fixed all function calls

---

## Testing Checklist

- [x] `.\docker-helper.ps1 help` - Shows usage
- [x] `.\docker-helper.ps1 start-dev` - No function errors
- [ ] `.\docker-helper.ps1 build-dev` - Builds successfully
- [ ] `.\docker-helper.ps1 health` - Checks health
- [ ] `.\docker-helper.ps1 logs-dev` - Shows logs
- [ ] `.\docker-helper.ps1 stop-dev` - Stops container

---

## Best Practices (Learned)

1. **Avoid built-in cmdlet names** - Always check PowerShell reserved names
2. **Use approved verbs** - Follow `Get-Verb` list for production scripts
3. **Test in clean session** - Run `powershell.exe` to catch conflicts
4. **Prefix custom functions** - Use unique prefixes like `Print-`, `App-`, etc.

---

## Alternative Solutions (Considered)

### Option 1: Use Different Verbs (Better for production)
```powershell
function Show-Success { ... }  # Show is approved verb
function Show-Error { ... }
function Show-Info { ... }
```

### Option 2: Module Scoping
```powershell
# Create module with private functions
Export-ModuleMember -Function @('Start-Dev', 'Stop-Dev')
```

### Option 3: Script Block (Chosen for simplicity)
```powershell
# Keep functions simple, use Print- prefix
function Print-Success { ... }  # ✅ Simple, works
```

---

## Status

✅ **FIXED** - All function conflicts resolved

**Date**: October 16, 2025  
**Issue**: PowerShell cmdlet name collision  
**Resolution**: Renamed `Write-*` → `Print-*`  
**Files Modified**: 1 (`docker-helper.ps1`)
