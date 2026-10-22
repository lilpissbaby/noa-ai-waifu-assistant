# Plugins de NSIS

`x86-unicode/WinShell.dll` es el plugin **WinShell** de NSIS (licencia zlib/libpng), copiado de los
recursos de NSIS que publica electron-builder
([`nsis-resources-3.4.1`](https://github.com/electron-userland/electron-builder-binaries/releases/tag/nsis-resources-3.4.1)).

El instalador lo usa para poner el AppUserModelID (`desk.waifu.app`) al acceso directo del menú Inicio.
Sin eso, Windows no muestra las notificaciones de la app.

SHA-256: `9be85b986ea66a6997dde658abe82b3147ed2a1a3dcb784bb5176f41d22815a6`
