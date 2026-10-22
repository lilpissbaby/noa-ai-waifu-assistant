; Instalador de Waifu Desk para Windows (NSIS 3, Modern UI 2).
; Se compila con makensis de forma nativa en Linux, macOS o Windows:
;   makensis -DVERSION=0.1.0 -DSRC=dist/win-unpacked -DOUT=dist/WaifuDesk-Setup-0.1.0.exe build/installer.nsi
; Instala por usuario (sin pedir permisos de administrador) en %LOCALAPPDATA%\Programs\Waifu Desk.

Unicode true
!ifdef FAST
  SetCompressor zlib
!else
  SetCompressor /SOLID lzma
  SetCompressorDictSize 64
!endif
ManifestDPIAware true

!ifndef VERSION
  !define VERSION "0.1.0"
!endif
!ifndef SRC
  !define SRC "..\dist\win-unpacked"
!endif
!ifndef OUT
  !define OUT "..\dist\WaifuDesk-Setup-${VERSION}.exe"
!endif

!define APPNAME "Waifu Desk"
!define EXENAME "Waifu Desk.exe"
!define APPID "desk.waifu.app"
!define UNINSTKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPID}"

Name "${APPNAME}"
OutFile "${OUT}"
InstallDir "$LOCALAPPDATA\Programs\${APPNAME}"
InstallDirRegKey HKCU "Software\${APPNAME}" "InstallDir"
RequestExecutionLevel user
BrandingText "${APPNAME} ${VERSION}"

VIProductVersion "${VERSION}.0"
VIAddVersionKey /LANG=1034 "ProductName" "${APPNAME}"
VIAddVersionKey /LANG=1034 "FileDescription" "Instalador de ${APPNAME}"
VIAddVersionKey /LANG=1034 "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=1034 "ProductVersion" "${VERSION}"
VIAddVersionKey /LANG=1034 "LegalCopyright" "MIT"

!ifdef PLUGINDIR
  !addplugindir /x86-unicode "${PLUGINDIR}"
  !define HAVE_WINSHELL
!endif

!include "MUI2.nsh"
!include "LogicLib.nsh"

!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Instalar ${APPNAME}"
!define MUI_WELCOMEPAGE_TEXT "Vas a instalar ${APPNAME} ${VERSION}, tu asistente de IA que vive encima del escritorio.$\r$\n$\r$\nSe instala solo para tu usuario y no necesita permisos de administrador."
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXENAME}"
!define MUI_FINISHPAGE_RUN_TEXT "Abrir ${APPNAME} ahora"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "Spanish"

; Cierra la app si está abierta (para poder sobrescribir sus archivos).
!macro CloseApp
  nsExec::Exec 'taskkill /IM "${EXENAME}" /F'
  Pop $0
  Sleep 600
!macroend

Section "Waifu Desk" SecMain
  SectionIn RO
  !insertmacro CloseApp
  SetOutPath "$INSTDIR"
  ; borra restos de una versión anterior, pero no los datos del usuario (están en AppData\Roaming)
  RMDir /r "$INSTDIR\resources"
  RMDir /r "$INSTDIR\locales"
  File /r "${SRC}\*.*"

  WriteUninstaller "$INSTDIR\Desinstalar ${APPNAME}.exe"
  WriteRegStr HKCU "Software\${APPNAME}" "InstallDir" "$INSTDIR"

  CreateDirectory "$SMPROGRAMS\${APPNAME}"
  CreateShortCut "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk" "$INSTDIR\${EXENAME}" "" "$INSTDIR\${EXENAME}" 0
  !ifdef HAVE_WINSHELL
    ; Windows solo muestra notificaciones de apps cuyo acceso del menú Inicio lleva su AppUserModelID.
    WinShell::SetLnkAUMI "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk" "${APPID}"
  !endif
  CreateShortCut "$SMPROGRAMS\${APPNAME}\Desinstalar ${APPNAME}.lnk" "$INSTDIR\Desinstalar ${APPNAME}.exe"
  CreateShortCut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\${EXENAME}" "" "$INSTDIR\${EXENAME}" 0

  ; entrada en "Aplicaciones instaladas"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayName" "${APPNAME}"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINSTKEY}" "Publisher" "mupsim"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayIcon" "$INSTDIR\${EXENAME},0"
  WriteRegStr HKCU "${UNINSTKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTKEY}" "UninstallString" '"$INSTDIR\Desinstalar ${APPNAME}.exe"'
  WriteRegStr HKCU "${UNINSTKEY}" "QuietUninstallString" '"$INSTDIR\Desinstalar ${APPNAME}.exe" /S'
  WriteRegDWORD HKCU "${UNINSTKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTKEY}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  !insertmacro CloseApp
  Delete "$DESKTOP\${APPNAME}.lnk"
  RMDir /r "$SMPROGRAMS\${APPNAME}"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "${UNINSTKEY}"
  DeleteRegKey HKCU "Software\${APPNAME}"
  ; quita el arranque automático si se activó en Ajustes
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${APPID}"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${APPNAME}"
  ; Los ajustes, claves y skins se conservan en %APPDATA%\Waifu Desk por si vuelves a instalar.
SectionEnd
