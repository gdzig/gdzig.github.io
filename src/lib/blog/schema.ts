import { z } from 'astro/zod';

const httpUrl = z.string().url().refine(value => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}, 'Use an HTTP(S) URL without credentials.').transform(value => new URL(value).href);

const localImage = z.string().refine(value =>
  value.startsWith('/') && !value.startsWith('//') && !/[\\?#]/.test(value),
  'Use a site-root-relative image path without a query or fragment.');
const coverSrc = z.union([localImage, httpUrl]);
const shareSrc = z.union([
  localImage,
  httpUrl.refine(value => value.startsWith('https://'), 'Remote share images require HTTPS.'),
]);
const dateValue = z.union([
  z.date(),
  z.iso.date().transform(value => new Date(`${value}T00:00:00.000Z`)),
  z.iso.datetime({ offset: true }).transform(value => new Date(value)),
]).pipe(z.date());
const nonempty = z.string().trim().min(1);

export const blogSchema = z.object({
  title: nonempty,
  description: nonempty,
  author: z.object({ name: nonempty, url: httpUrl.optional() }),
  draft: z.boolean().default(true),
  publishedAt: dateValue.optional(),
  updatedAt: dateValue.optional(),
  tags: z.array(nonempty).default([]),
  section: nonempty.optional(),
  cover: z.object({ src: coverSrc, alt: nonempty }).optional(),
  ogImage: z.object({
    src: shareSrc,
    alt: nonempty,
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    type: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  }).optional(),
  source: z.object({ url: httpUrl, publishedAt: dateValue.optional() }).optional(),
}).superRefine((data, ctx) => {
  if (!data.draft && !data.publishedAt) {
    ctx.addIssue({ code: 'custom', path: ['publishedAt'], message: 'Published posts require publishedAt.' });
  }
  if (data.updatedAt && data.publishedAt && data.updatedAt < data.publishedAt) {
    ctx.addIssue({ code: 'custom', path: ['updatedAt'], message: 'updatedAt cannot precede publishedAt.' });
  }
});

export type BlogData = z.infer<typeof blogSchema>;
