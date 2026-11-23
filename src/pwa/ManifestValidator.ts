import type { Page } from '@playwright/test';
import { z } from 'zod';

const iconSchema = z.object({
  src: z.string().min(1),
  sizes: z.string().optional(),
  type: z.string().optional(),
  purpose: z.string().optional(),
});

export const manifestSchema = z.object({
  name: z.string().min(1),
  short_name: z.string().optional(),
  start_url: z.string().min(1),
  display: z.enum(['standalone', 'fullscreen', 'minimal-ui', 'browser']),
  theme_color: z.string().optional(),
  background_color: z.string().optional(),
  icons: z.array(iconSchema).min(1),
});

export type WebManifest = z.infer<typeof manifestSchema>;

export class ManifestValidator {
  constructor(private readonly page: Page) {}

  async href(): Promise<string | null> {
    return this.page.locator('link[rel="manifest"]').first().getAttribute('href');
  }

  async fetch(): Promise<unknown> {
    const href = await this.href();
    if (!href) throw new Error('No <link rel="manifest"> found on the page');
    const url = new URL(href, this.page.url()).toString();
    const res = await this.page.request.get(url);
    if (!res.ok()) throw new Error(`Manifest request failed: ${res.status()} ${url}`);
    return res.json();
  }

  async validate(): Promise<WebManifest> {
    return manifestSchema.parse(await this.fetch());
  }

  /** Installability requires at least a 192px and a 512px icon. */
  static hasRequiredIcons(manifest: WebManifest): boolean {
    const sizes = manifest.icons.flatMap((i) => (i.sizes ?? '').split(' '));
    return sizes.includes('192x192') && sizes.includes('512x512');
  }
}
