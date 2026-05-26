import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

async function ensureDirectory(filePath: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

export async function readJsonStore<T>(
  filePath: string,
  fallback: T
): Promise<T> {
  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content) as T;
  } catch {
    await ensureDirectory(filePath);
    await writeFile(filePath, JSON.stringify(fallback, null, 2), "utf8");
    return fallback;
  }
}

export async function writeJsonStore<T>(
  filePath: string,
  value: T
): Promise<T> {
  await ensureDirectory(filePath);
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
  return value;
}
