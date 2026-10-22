; Instalador de Waifu Desk para Windows (NSIS 3, Modern UI 2).
; Se compila con makensis de forma nativa en Linux, macOS o Windows (lo hace build/make-installer.mjs):
;   makensis -DVERSION=0.2.0 -DSRC=dist/win-unpacked -DOUT=dist/WaifuDesk-Setup-0.2.0.exe build/installer.nsi
; Instala por usuario (sin pedir permisos de administrador) en %LOCALAPPDATA%\Programs\Waifu Desk.
; Idiomas: inglés, español, ruso, ucraniano y chino; NSIS elige solo el del sistema (inglés si no está).

Unicode true
!ifdef FAST
  SetCompressor zlib
!else
  SetCompressor /SOLID lzma
  SetCompressorDictSize 64
!endif
ManifestDPIAware true

!ifndef VERSION
  !define VERSION "0.0.0"
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

; VIProductVersion necesita X.X.X.X: se quita el sufijo de prerelease (0.3.0-beta.1 -> 0.3.0).
!searchparse /noerrors "${VERSION}" "" VERNUM "-"
!ifndef VERNUM
  !define VERNUM "${VERSION}"
!endif
VIProductVersion "${VERNUM}.0"
VIAddVersionKey /LANG=1033 "ProductName" "${APPNAME}"
VIAddVersionKey /LANG=1033 "FileDescription" "${APPNAME} Setup"
VIAddVersionKey /LANG=1033 "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=1033 "ProductVersion" "${VERSION}"
VIAddVersionKey /LANG=1033 "LegalCopyright" "MIT"

!ifdef PLUGINDIR
  !addplugindir /x86-unicode "${PLUGINDIR}"
  !define HAVE_WINSHELL
!endif

!include "MUI2.nsh"
!include "LogicLib.nsh"

!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "$(WD_WelcomeTitle)"
!define MUI_WELCOMEPAGE_TEXT "$(WD_WelcomeText)"
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXENAME}"
!define MUI_FINISHPAGE_RUN_TEXT "$(WD_RunNow)"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; El primero es el de reserva cuando el idioma del sistema no está en la lista.
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "Spanish"
!insertmacro MUI_LANGUAGE "Russian"
!insertmacro MUI_LANGUAGE "Ukrainian"
!insertmacro MUI_LANGUAGE "SimpChinese"

!define WD_INTRO_EN "You are about to install ${APPNAME} ${VERSION}, your AI assistant that lives on top of your desktop.$\r$\n$\r$\nIt is installed for your user only and does not need administrator rights."
!define WD_INTRO_ES "Vas a instalar ${APPNAME} ${VERSION}, tu asistente de IA que vive encima del escritorio.$\r$\n$\r$\nSe instala solo para tu usuario y no necesita permisos de administrador."
!define WD_INTRO_RU "Сейчас будет установлен ${APPNAME} ${VERSION} — ИИ-ассистент, который живёт поверх рабочего стола.$\r$\n$\r$\nПрограмма ставится только для вашего пользователя и не требует прав администратора."
!define WD_INTRO_UK "Зараз буде встановлено ${APPNAME} ${VERSION} — ШІ-асистентку, яка живе поверх робочого столу.$\r$\n$\r$\nПрограма встановлюється лише для вашого користувача й не потребує прав адміністратора."
!define WD_INTRO_ZH "即将安装 ${APPNAME} ${VERSION}，一个住在桌面上方的 AI 助手。$\r$\n$\r$\n只为当前用户安装，不需要管理员权限。"

LangString WD_WelcomeTitle ${LANG_ENGLISH} "Install ${APPNAME}"
LangString WD_WelcomeTitle ${LANG_SPANISH} "Instalar ${APPNAME}"
LangString WD_WelcomeTitle ${LANG_RUSSIAN} "Установка ${APPNAME}"
LangString WD_WelcomeTitle ${LANG_UKRAINIAN} "Встановлення ${APPNAME}"
LangString WD_WelcomeTitle ${LANG_SIMPCHINESE} "安装 ${APPNAME}"
LangString WD_WelcomeText ${LANG_ENGLISH} "${WD_INTRO_EN}"
LangString WD_WelcomeText ${LANG_SPANISH} "${WD_INTRO_ES}"
LangString WD_WelcomeText ${LANG_RUSSIAN} "${WD_INTRO_RU}"
LangString WD_WelcomeText ${LANG_UKRAINIAN} "${WD_INTRO_UK}"
LangString WD_WelcomeText ${LANG_SIMPCHINESE} "${WD_INTRO_ZH}"
LangString WD_RunNow ${LANG_ENGLISH} "Open ${APPNAME} now"
LangString WD_RunNow ${LANG_SPANISH} "Abrir ${APPNAME} ahora"
LangString WD_RunNow ${LANG_RUSSIAN} "Запустить ${APPNAME}"
LangString WD_RunNow ${LANG_UKRAINIAN} "Запустити ${APPNAME}"
LangString WD_RunNow ${LANG_SIMPCHINESE} "立即打开 ${APPNAME}"
LangString WD_UninstallLnk ${LANG_ENGLISH} "Uninstall ${APPNAME}"
LangString WD_UninstallLnk ${LANG_SPANISH} "Desinstalar ${APPNAME}"
LangString WD_UninstallLnk ${LANG_RUSSIAN} "Удалить ${APPNAME}"
LangString WD_UninstallLnk ${LANG_UKRAINIAN} "Видалити ${APPNAME}"
LangString WD_UninstallLnk ${LANG_SIMPCHINESE} "卸载 ${APPNAME}"

; El desinstalador tiene un nombre fijo; la 0.1.0 lo llamaba «Desinstalar Waifu Desk.exe».
!define UNINSTEXE "Uninstall ${APPNAME}.exe"
!define OLD_UNINSTEXE "Desinstalar ${APPNAME}.exe"

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

  Delete "$INSTDIR\${OLD_UNINSTEXE}"
  RMDir /r "$SMPROGRAMS\${APPNAME}"
  WriteUninstaller "$INSTDIR\${UNINSTEXE}"
  WriteRegStr HKCU "Software\${APPNAME}" "InstallDir" "$INSTDIR"

  CreateDirectory "$SMPROGRAMS\${APPNAME}"
  CreateShortCut "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk" "$INSTDIR\${EXENAME}" "" "$INSTDIR\${EXENAME}" 0
  !ifdef HAVE_WINSHELL
    ; Windows solo muestra notificaciones de apps cuyo acceso del menú Inicio lleva su AppUserModelID.
    WinShell::SetLnkAUMI "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk" "${APPID}"
  !endif
  CreateShortCut "$SMPROGRAMS\${APPNAME}\$(WD_UninstallLnk).lnk" "$INSTDIR\${UNINSTEXE}"
  CreateShortCut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\${EXENAME}" "" "$INSTDIR\${EXENAME}" 0

  ; entrada en "Aplicaciones instaladas"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayName" "${APPNAME}"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINSTKEY}" "Publisher" "mupsim"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayIcon" "$INSTDIR\${EXENAME},0"
  WriteRegStr HKCU "${UNINSTKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTKEY}" "UninstallString" '"$INSTDIR\${UNINSTEXE}"'
  WriteRegStr HKCU "${UNINSTKEY}" "QuietUninstallString" '"$INSTDIR\${UNINSTEXE}" /S'
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
