import fs from 'node:fs';
import path from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { Logger } from '@utils/logger/Logger';
import { UiActionError } from './UiActionError';

type Target = Locator;

/**
 * Every user interaction goes through here: one place for logging, consistent
 * error context and (if ever needed) retries. Pages COMPOSE this class instead of inheriting it.
 */
export class UiActions {
  private readonly log: Logger;

  constructor(
    private readonly page: Page,
    context: string,
  ) {
    this.log = Logger.for(context);
  }

  private async run<T>(action: string, target: Target, label: string | undefined, fn: () => Promise<T>): Promise<T> {
    const name = label ?? String(target);
    this.log.debug(`${action} -> ${name}`);
    try {
      return await fn();
    } catch (error) {
      this.log.error(`${action} failed -> ${name}`);
      throw new UiActionError(action, name, this.page.url(), error);
    }
  }

  async click(target: Target, label?: string): Promise<void> {
    await this.run('click', target, label, () => target.click());
  }

  /**
   * Clicks the element's centre even if another element sits on top. Use ONLY when the click handler lives
   * on a wrapper above the target (common in React Native Web, where the visible text is covered by its
   * pressable row). A real user's click lands on the same wrapper, so this matches real behaviour. For
   * normal elements prefer click(): its "is this really clickable" checks catch real overlay bugs.
   */
  async clickThrough(target: Target, label?: string): Promise<void> {
    await this.run('click (through overlay)', target, label, async () => {
      // A coordinate click: Playwright's hit-target check is skipped and the browser delivers the event to
      // whatever is really on top, exactly as for a user's finger/mouse.
      const box = await target.boundingBox();
      if (!box) throw new Error('element has no visible box');
      await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    });
  }

  async doubleClick(target: Target, label?: string): Promise<void> {
    await this.run('double-click', target, label, () => target.dblclick());
  }

  async hover(target: Target, label?: string): Promise<void> {
    await this.run('hover', target, label, () => target.hover());
  }

  /** Clears then types, so stale values never leak into a test. */
  async fill(target: Target, value: string, label?: string): Promise<void> {
    await this.run('fill', target, label, () => target.fill(value));
  }

  /** Character-by-character typing for inputs that react to key events (autocomplete, masks). */
  async type(target: Target, value: string, label?: string): Promise<void> {
    await this.run('type into', target, label, async () => {
      await target.clear();
      await target.pressSequentially(value);
    });
  }

  async press(target: Target, key: string, label?: string): Promise<void> {
    await this.run(`press ${key} on`, target, label, () => target.press(key));
  }

  async check(target: Target, label?: string): Promise<void> {
    await this.run('check', target, label, () => target.check());
  }

  async uncheck(target: Target, label?: string): Promise<void> {
    await this.run('uncheck', target, label, () => target.uncheck());
  }

  /** Native <select>. Accepts value, visible label or index. */
  async selectOption(
    target: Target,
    option: string | { label: string } | { value: string } | { index: number },
    label?: string,
  ): Promise<void> {
    await this.run('select option in', target, label, async () => {
      await target.selectOption(option);
    });
  }

  /** Custom (non-native) dropdown: open the trigger, then pick the option by accessible name. */
  async selectCustom(trigger: Target, optionName: string | RegExp, label?: string): Promise<void> {
    await this.run(`select "${String(optionName)}" from`, trigger, label, async () => {
      await trigger.click();
      await this.page.getByRole('option', { name: optionName }).click();
    });
  }

  /** Upload to a (possibly hidden) <input type="file">. Fails early if a file does not exist. */
  async upload(input: Target, files: string | string[], label?: string): Promise<void> {
    const list = (Array.isArray(files) ? files : [files]).map((f) => path.resolve(f));
    const missing = list.filter((f) => !fs.existsSync(f));
    if (missing.length) {
      throw new UiActionError('upload to', label ?? String(input), this.page.url(), `File not found: ${missing.join(', ')}`);
    }
    await this.run('upload to', input, label, () => input.setInputFiles(list));
  }

  /** Upload when the page only exposes a button that opens the native file chooser. */
  async uploadViaChooser(trigger: Target, files: string | string[], label?: string): Promise<void> {
    const list = (Array.isArray(files) ? files : [files]).map((f) => path.resolve(f));
    await this.run('upload via chooser from', trigger, label, async () => {
      const [chooser] = await Promise.all([this.page.waitForEvent('filechooser'), trigger.click()]);
      await chooser.setFiles(list);
    });
  }

  async text(target: Target, label?: string): Promise<string> {
    return this.run('read text of', target, label, async () => (await target.innerText()).trim());
  }

  async value(target: Target, label?: string): Promise<string> {
    return this.run('read value of', target, label, () => target.inputValue());
  }
}
