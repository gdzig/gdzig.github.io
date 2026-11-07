// Load the ESM parser before sanitize-html's CommonJS require of the same module.
import { DomUtils, parseDocument } from 'htmlparser2';
import sanitizeHtml from 'sanitize-html';

/** Convert rendered article markup into a standalone reader fragment. */
export function articleFeedHtml(html: string, articleUrl: URL): string {
  const document = parseDocument(html);
  // Remove hidden UI before code flattening and sanitization, without renaming tags.
  for (const element of DomUtils.findAll(element =>
    'hidden' in element.attribs || element.attribs['aria-hidden'] === 'true' || (element.attribs.class?.split(/\s+/).includes('copy') ?? false), document.children)) {
    DomUtils.removeElement(element);
  }
  for (const code of DomUtils.findAll(element => element.name === 'code', document.children)) {
    const lines = DomUtils.findAll(element => element.attribs.class?.split(/\s+/).includes('ec-line') ?? false, code.children);
    if (!lines.length) continue;
    // Expressive Code uses styled divs instead of literal newlines, including
    // gutter line numbers and a newline placeholder for each empty source line.
    const text = lines.map(line => {
      const body = DomUtils.findOne(element => element.attribs.class?.split(/\s+/).includes('code') ?? false, line.children);
      const value = DomUtils.textContent(body ?? line);
      return value === '\n' ? '' : value;
    }).join('\n');
    code.children = parseDocument(text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')).children;
    for (const child of code.children) child.parent = code;
  }
  return sanitizeHtml(DomUtils.getOuterHTML(document), {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'picture', 'source', 'video', 'audio'],
    allowedAttributes: {
      '*': ['id', 'title', 'lang', 'dir'],
      a: ['href', 'rel'],
      img: ['src', 'alt', 'width', 'height'],
      source: ['src', 'type'],
      video: ['src', 'poster', 'controls', 'width', 'height'],
      audio: ['src', 'controls'],
      ol: ['start', 'reversed'],
      li: ['value'],
      th: ['colspan', 'rowspan', 'scope'],
      td: ['colspan', 'rowspan'],
    },
    allowedSchemes: ['https', 'http', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['https', 'http'], source: ['https', 'http'], video: ['https', 'http'], audio: ['https', 'http'] },
    allowedSchemesAppliedToAttributes: ['href', 'src', 'poster'],
    // Drop controls and their labels together, not just the interactive tag.
    nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript', 'template', 'button', 'form', 'select', 'iframe', 'object', 'svg', 'feed-omit'],
    transformTags: {
      '*': (tagName, attribs) => {
        for (const attribute of ['href', 'src', 'poster']) {
          if (attribs[attribute] !== undefined) {
            try { attribs[attribute] = new URL(attribs[attribute], articleUrl).href; }
            catch { delete attribs[attribute]; }
          }
        }
        return { tagName, attribs };
      },
    },
  });
}
