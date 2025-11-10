import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Sanitize file names for storage keys (converts to ASCII-safe characters)
export function sanitizeFileName(name: string) {
  const extMatch = name.match(/\.([A-Za-z0-9]+)$/);
  const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : '.pdf';
  const base = name.replace(/\.[^/.]+$/, "");
  
  // Convert to ASCII-safe characters for Supabase Storage
  const safe = base
    .normalize('NFD') // Normalize unicode characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^\x00-\x7F]/g, '') // Remove all non-ASCII characters (including Hebrew)
    .replace(/[<>:"/\\|?*\x00-\x1f\s]/g, '-') // Replace unsafe characters and spaces with dash
    .replace(/-+/g, '-') // Replace multiple dashes with single dash
    .replace(/^-|-$/g, ''); // Remove leading/trailing dashes
  
  // If name becomes empty after sanitization, use timestamp-based name
  if (!safe) {
    const unique = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    return `file-${unique}${ext}`;
  }
  return `${safe}${ext}`;
}

export function buildStoragePath(folder: string, originalName: string) {
  const fileName = sanitizeFileName(originalName);
  return `${folder}/${fileName}`;
}
