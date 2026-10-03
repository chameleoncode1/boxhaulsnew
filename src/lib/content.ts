/** Where a page's copy lives (Prompt 4): src/content/pages/<url-as-path>.mdx, with "/" at index.mdx. */
export function contentFile(url: string): string {
  return url === '/' ? 'src/content/pages/index.mdx' : `src/content/pages${url.slice(0, -1)}.mdx`;
}
