import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { file } from 'astro/loaders';
import { z } from 'astro/zod';

const showcaseLink = z.object({
  label: z.string(),
  url: z.string().url(),
  icon: z.enum(['github', 'godot', 'steam']),
});

const showcase = defineCollection({
  loader: file('src/content/showcase/projects.json'),
  schema: z.object({
    id: z.string(),
    title: z.string(),
    author: z.string().optional(),
    category: z.enum(['games', 'extensions']),
    primaryLink: showcaseLink,
    sourceLink: showcaseLink.optional(),
    summary: z.string(),
    note: z.string().optional(),
    tags: z.array(z.string()).default([]),
    details: z.array(z.string()).default([]),
    image: z
      .object({
        src: z.string(),
        alt: z.string(),
      })
      .optional(),
  }),
});

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  showcase,
};
