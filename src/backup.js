import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { exportAll, importAll } from "./db";

export async function shareBackup() {
  const data = await exportAll();
  const path = `penny-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const { uri } = await Filesystem.writeFile({
    path,
    data: JSON.stringify(data, null, 2),
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });
  await Share.share({ title: "Penny backup", url: uri }); // pick Drive, email, etc.
  return data.expenses.length;
}

export async function restoreFromFile(file) {
  return importAll(JSON.parse(await file.text()));
}
