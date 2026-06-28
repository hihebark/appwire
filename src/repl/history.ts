import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

const HISTORY_FILE = join(homedir(), ".appwire_history");
const MAX_ENTRIES = 1000;

export async function loadHistory(): Promise<string[]> {
  try {
    const raw = await readFile(HISTORY_FILE, "utf8");
    return raw.split("\n").filter(Boolean).slice(-MAX_ENTRIES);
  } catch {
    return [];
  }
}

export async function saveHistory(entries: string[]): Promise<void> {
  try {
    await writeFile(
      HISTORY_FILE,
      entries.slice(-MAX_ENTRIES).join("\n") + "\n",
      "utf8",
    );
  } catch {
    /* best-effort */
  }
}

export function addEntry(history: string[], line: string): void {
  // Deduplicate: remove existing entry, append new
  const idx = history.lastIndexOf(line);
  if (idx !== -1) history.splice(idx, 1);
  history.push(line);
  if (history.length > MAX_ENTRIES) history.shift();
}
