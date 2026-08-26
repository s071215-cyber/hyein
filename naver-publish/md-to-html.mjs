import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: true });

export function markdownToHtml(markdown) {
  return marked.parse(markdown);
}
