import { realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import sharp from 'sharp';
import type { BlogData } from './schema';

export type ShareImage = NonNullable<BlogData['ogImage']>;

function requireWithin(root: string, file: string): void {
  const path = relative(root, file);
  if (path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path)) {
    throw new Error('Share image must remain inside public/.');
  }
}

export async function validateShareImage(image: ShareImage, publicDirectory: string): Promise<void> {
  // Remote overrides are metadata only. Never fetch them during a build.
  if (image.src.startsWith('https://')) return;
  try {
    if (!image.src.startsWith('/') || image.src.startsWith('//') || /[\\?#]/.test(image.src)) {
      throw new Error('Use a site-root-relative image path without a query or fragment.');
    }
    // Decode once, without URL normalization silently removing dot segments.
    const pathname = decodeURIComponent(image.src);
    if (pathname.startsWith('//') || /[\\\0]/.test(pathname)) {
      throw new Error('Use a local image pathname without backslashes or null bytes.');
    }
    const root = await realpath(publicDirectory);
    const candidate = resolve(root, `.${pathname}`);
    requireWithin(root, candidate);
    const file = await realpath(candidate);
    requireWithin(root, file);
    const actual = await sharp(file).metadata();
    const type = actual.format === 'jpeg' ? 'image/jpeg' : `image/${actual.format}`;
    if (actual.width !== image.width || actual.height !== image.height || type !== image.type) {
      throw new Error(`Expected ${image.width}x${image.height} ${image.type}, found ${actual.width}x${actual.height} ${type}.`);
    }
  } catch (cause) {
    throw new Error(`Invalid blog ogImage ${image.src}: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
  }
}
