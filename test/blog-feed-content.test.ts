import { expect, test } from 'bun:test';
import { articleFeedHtml } from '../src/lib/blog/feed-content';
import { inspectHtml } from './helpers/feeds';

const url = new URL('https://gdzig.github.io/blog/nested/article/');

test('turns Expressive Code line wrappers into exact plain code with blank lines and indentation', async () => {
  const html = articleFeedHtml('<pre><code><div class="ec-line"><div class="gutter">1</div><div class="code"><span>first &amp;amp;</span></div></div><div class="ec-line"><div class="gutter">2</div><div class="code">\n</div></div><div class="ec-line"><div class="gutter">3</div><div class="code"><span class="indent">  </span>last &lt;tag&gt;</div></div></code></pre>', url);
  expect((await inspectHtml(html)).text).toBe('first &amp;\n\n  last <tag>');
  expect(html).toBe('<pre><code>first &amp;amp;\n\n  last &lt;tag&gt;</code></pre>');
});

test('preserves complete semantic article HTML, code and literal entities', async () => {
  const html = articleFeedHtml('<h2 id="section">Heading</h2><p>Start <strong>bold</strong> &amp; detail.</p><pre class="astro-code" style="color:red"><code>const s = "&amp;amp;"; // ]]&gt; ]]&gt; &lt;script&gt;</code></pre><table><thead><tr><th>Key</th></tr></thead><tbody><tr><td>Value</td></tr></tbody></table><p>Ending.</p>', url);
  const parsed = await inspectHtml(html);
  expect(parsed.text).toContain('Start bold & detail.');
  expect(parsed.text).toContain('const s = "&amp;"; // ]]> ]]> <script>');
  expect(parsed.text).toContain('ValueEnding.');
  for (const tag of ['h2', 'strong', 'pre', 'code', 'table', 'thead', 'tbody', 'th', 'td']) {
    expect(parsed.elements.map(element => element.tag)).toContain(tag);
  }
  expect(html).toContain('id="section"');
  expect(html).not.toMatch(/class=|style=/);
});

test('resolves root-relative, article-relative, fragment and external links for standalone readers', async () => {
  const html = articleFeedHtml('<p><a href="/docs/?a=1&amp;b=2">Root</a><a href="../sibling/">Sibling</a><a href="#section">Section</a><a href="https://example.com/">External</a><a href="mailto:author@example.com">Mail</a></p><img src="./diagram.png" alt="A diagram" width="320" height="200"/><img src="//cdn.example.com/image.png" alt="CDN"/>', url);
  const parsed = await inspectHtml(html);
  expect(parsed.elements.filter(element => element.tag === 'a').map(element => element.href)).toEqual([
    'https://gdzig.github.io/docs/?a=1&amp;b=2',
    'https://gdzig.github.io/blog/nested/sibling/',
    url.href + '#section',
    'https://example.com/',
    'mailto:author@example.com',
  ]);
  expect(html).toContain('src="https://gdzig.github.io/blog/nested/article/diagram.png"');
  expect(html).toContain('src="https://cdn.example.com/image.png"');
  expect(html).toContain('alt="A diagram"');
  expect(html).toContain('width="320"');
});

test('uses fallback images without page-only responsive attributes and resolves media URLs', () => {
  const html = articleFeedHtml('<picture><source srcset="/small.png 1x, ./large.png 2x" type="image/png"/><img src="/fallback.png" alt="Responsive" srcset="./one.png 400w, ../two.png 800w"/></picture><video controls poster="/poster.png"><source src="./clip.mp4" type="video/mp4"/></video>', url);
  expect(html).not.toContain('srcset=');
  expect(html).toContain('src="https://gdzig.github.io/fallback.png"');
  expect(html).toContain('poster="https://gdzig.github.io/poster.png"');
  expect(html).toContain('src="https://gdzig.github.io/blog/nested/article/clip.mp4"');
});

test('removes executable HTML, website controls and hidden UI without losing component prose', async () => {
  const html = articleFeedHtml('<astro-island component-url="/client.js" props="secret"><p>Component prose.</p></astro-island><!-- private comment --><script>BAD_SCRIPT</script><style>.BAD_STYLE{}</style><template>BAD_TEMPLATE</template><form><p>BAD_FORM</p><input value="BAD_INPUT"/></form><div class="copy"><button>BAD_COPY</button><div aria-live="polite">BAD_FEEDBACK</div></div><button>BAD_BUTTON</button><span aria-hidden="true">BAD_HIDDEN</span><p hidden>BAD_HIDDEN_ATTRIBUTE</p><p onclick="BAD_HANDLER()">Readable ending.</p>', url);
  const parsed = await inspectHtml(html);
  expect(parsed.text).toBe('Component prose.Readable ending.');
  expect(html).not.toMatch(/BAD_|script|style|template|form|input|button|aria-live|astro-island|component-url|props=|onclick|private comment/);
});

test('drops unsafe URL schemes and attributes even when encoded or malformed', () => {
  const html = articleFeedHtml('<p><a href="jav&#x61;script:alert(1)" onclick="evil()">Unsafe</a><a href="data:text/html,evil">Data</a><a href="http://[">Malformed</a></p><img src="javascript:evil()" onerror="evil()"/><iframe src="https://example.com/">BAD_IFRAME</iframe><object data="/bad">BAD_OBJECT</object>', url);
  expect(html).not.toMatch(/javascript:|data:text|onclick|onerror|http:\/\/\[|iframe|object|BAD_/i);
  expect(html).toContain('Unsafe');
  expect(html).toContain('Malformed');
});
