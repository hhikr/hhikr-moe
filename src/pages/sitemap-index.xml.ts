import type { APIRoute } from 'astro';
import { sitemapIndex, xml } from '@/lib/sitemap';

export const prerender = false;

export const GET: APIRoute = () => xml(sitemapIndex());
