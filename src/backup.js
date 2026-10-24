import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { exportAll, importAll } from "./db";
import { todayLocal } from "./money";

export async function shareBackup() {
  const data = await exportAll();
  const path = `penny-backup-${todayLocal()}.json`;
  const { uri } = await Filesystem.writeFile({
    path,
    data: JSON.stringify(data, null, 2),
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });
  try {
    await Share.share({ title: "Penny backup", url: uri }); // pick Drive, email, etc.
  } catch (error) {
    if (!/cancel+ed|cancel+led/i.test(error?.message ?? "")) throw error;
  }
  return data.expenses.length;
}

export async function restoreFromFile(file) {
  return importAll(JSON.parse(await file.text()));
}
