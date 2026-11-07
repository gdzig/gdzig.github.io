import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import satori from 'satori';
import sharp from 'sharp';

export type CardInput = { title: string; eyebrow: string; author?: string };

// Adapted from the authorized generate-og-images.mjs textDiv/tree renderer.
// Fonts are private to generated images, never imported into browser CSS.
const palette = { background: '#15120d', text: '#f8efe3', muted: '#cbbca8', accent: '#f6a31d' };
const textDiv = (style: Record<string, string | number>, children: string) => ({ type: 'div', props: { style, children } });
const require = createRequire(import.meta.url);
const fonts: Parameters<typeof satori>[1]['fonts'] = [400, 600].flatMap(weight =>
  ['latin', 'latin-ext'].map(subset => ({
    name: subset === 'latin' ? 'GDZig Sans' : 'GDZig Sans Extended',
    data: readFileSync(require.resolve(`@fontsource/inter/files/inter-${subset}-${weight}-normal.woff`)),
    weight: weight as 400 | 600,
    style: 'normal' as const,
  })),
);
// Inter's packaged subsets omit U+2192. Only missing symbols use this local
// card-only fallback, explicitly authorized after inspecting the Unicode fixture.
fonts.push({
  name: 'GDZig Symbols',
  data: readFileSync(require.resolve('@fontsource/noto-sans-math/files/noto-sans-math-latin-400-normal.woff')),
  weight: 400,
  style: 'normal',
});

export function buildCardTree(input: CardInput): Parameters<typeof satori>[0] {
  const fontSize = input.title.length <= 70 ? 68 : input.title.length <= 140 ? 56 : 44;
  return {
    type: 'div', props: {
      style: {
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        width: 1200, height: 630, padding: 72, borderTop: `8px solid ${palette.accent}`,
        background: palette.background, color: palette.text, fontFamily: 'GDZig Sans, GDZig Sans Extended, GDZig Symbols',
      },
      children: [
        { type: 'div', props: { style: { display: 'flex', flexDirection: 'column' }, children: [
          textDiv({ fontSize: 24, color: palette.accent, marginBottom: 28, fontWeight: 600 }, input.eyebrow),
          textDiv({ display: 'block', wordBreak: 'break-word', fontSize, lineHeight: 1.12, fontWeight: 600, lineClamp: 4, overflow: 'hidden', textOverflow: 'ellipsis' }, input.title),
        ] } },
        textDiv({ display: 'block', whiteSpace: 'nowrap', wordBreak: 'break-word', fontSize: 24, color: palette.muted, fontWeight: 400, lineClamp: 1, overflow: 'hidden', textOverflow: 'ellipsis' },
          input.author ? `GDZig · ${input.author} · gdzig.github.io` : 'GDZig · gdzig.github.io'),
      ],
    },
  } as Parameters<typeof satori>[0];
}

export async function renderCard(input: CardInput): Promise<Buffer> {
  const svg = await satori(buildCardTree(input), { width: 1200, height: 630, fonts });
  return sharp(Buffer.from(svg)).png().toBuffer();
}
