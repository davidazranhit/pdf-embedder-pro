import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Sanitize file names for storage keys (supports Hebrew and other Unicode characters)
export function sanitizeFileName(name: string) {
  const extMatch = name.match(/\.([A-Za-z0-9]+)$/);
  const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : '.pdf';
  const base = name.replace(/\.[^/.]+$/, "");
  // Replace only unsafe characters for file systems, keep Hebrew and other Unicode
  const safe = base
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-') // Remove unsafe filesystem characters only
    .replace(/-+/g, '-') // Replace multiple dashes with single dash
    .replace(/^-|-$/g, ''); // Remove leading/trailing dashes
  
  // If name becomes empty after sanitization, make it unique
  if (!safe) {
    const unique = Math.random().toString(36).slice(2, 8);
    return `file-${unique}${ext}`;
  }
  return `${safe}${ext}`;
}

export function buildStoragePath(folder: string, originalName: string) {
  const fileName = sanitizeFileName(originalName);
  return `${folder}/${fileName}`;
}
