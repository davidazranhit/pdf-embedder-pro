import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Sanitize file names for storage keys (ASCII-only, safe characters)
export function sanitizeFileName(name: string) {
  const extMatch = name.match(/\.([A-Za-z0-9]+)$/);
  const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : '';
  const base = name.replace(/\.[^/.]+$/, "");
  // Normalize and strip diacritics, then replace non-ASCII chars with dash
  const ascii = base.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const safe = ascii
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${safe || 'file'}${ext || '.pdf'}`;
}

export function buildStoragePath(folder: string, originalName: string) {
  const fileName = sanitizeFileName(originalName);
  return `${folder}/${fileName}`;
}
