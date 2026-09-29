import path from 'node:path';

/**
 * Map a request path under /admin/ to a file inside adminDir.
 * Returns null for anything that is not a plain file path inside adminDir:
 * malformed %-encoding, NUL bytes, or traversal outside the folder.
 */
export function resolveAdminFile(pathname, adminDir) {
  let rel;
  try {
    rel = decodeURIComponent(pathname.slice('/admin/'.length)) || 'index.html';
  } catch {
    return null; // malformed %-sequence, e.g. "%E0"
  }
  if (rel.includes('\0')) return null;
  const file = path.resolve(adminDir, rel);
  return file.startsWith(adminDir + path.sep) ? file : null;
}
