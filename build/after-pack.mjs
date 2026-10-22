// Hook de electron-builder: en builds de Windows hechos desde Linux/macOS sin Wine
// (signAndEditExecutable: false) pone el icono y los datos de versión al .exe con resedit (JS puro).
import fs from 'node:fs';
import path from 'node:path';
import * as ResEdit from 'resedit';

export default async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const { appOutDir, packager } = context;
  const info = packager.appInfo;
  const exePath = path.join(appOutDir, `${info.productFilename}.exe`);
  const icoPath = path.join(packager.info.projectDir, 'build', 'icon.ico');
  if (!fs.existsSync(exePath) || !fs.existsSync(icoPath)) return;

  const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(exe);

  // Icono: sustituye el grupo de iconos principal de Electron.
  const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(icoPath));
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  const groupId = groups.length ? groups[0].id : 1;
  const lang = groups.length ? groups[0].lang : 1033;
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
    res.entries,
    groupId,
    lang,
    iconFile.icons.map((i) => i.data),
  );

  // Información de versión que muestra Windows (propiedades del archivo, administrador de tareas).
  const versions = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
  const vi = versions[0] || ResEdit.Resource.VersionInfo.createEmpty();
  const [ma, mi, pa] = info.version.split('.').map((n) => Number.parseInt(n, 10) || 0);
  vi.setFileVersion(ma, mi, pa, 0, 1033);
  vi.setProductVersion(ma, mi, pa, 0, 1033);
  vi.setStringValues(
    { lang: 1033, codepage: 1200 },
    {
      FileDescription: info.productName,
      ProductName: info.productName,
      InternalName: info.productFilename,
      OriginalFilename: `${info.productFilename}.exe`,
      CompanyName: info.companyName || 'mupsim',
      LegalCopyright: `MIT · ${new Date().getFullYear()}`,
    },
  );
  vi.outputToResourceEntries(res.entries);

  res.outputResource(exe);
  fs.writeFileSync(exePath, Buffer.from(exe.generate()));
  console.log(`  • afterPack: icono y versión aplicados a ${path.basename(exePath)}`);
}
