/** Returns true if the URL is a blog/posts/articles index page rather than an actual post */
export function isBlogIndexPage(pageUrl: string): boolean {
  const path = new URL(pageUrl).pathname.replace(/\/+$/, '');
  const segments = path.split('/').filter(Boolean);
  const last = segments[segments.length - 1]?.toLowerCase();
  return last === 'blog' || last === 'posts' || last === 'articles' || last === 'news';
}
