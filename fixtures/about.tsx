// Demo fixture — ssr-prerender advisory: static route, uncached per-request fetch.
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/about')({
  loader: async () => {
    const content = await fetchAboutPageContent();
    return { content };
  },
  component: AboutPage,
});
