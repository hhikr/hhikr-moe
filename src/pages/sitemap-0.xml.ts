import type { APIRoute } from 'astro';
import { urlset, xml } from '@/lib/sitemap';

export const prerender = false;

export const GET: APIRoute = () => xml(urlset());
