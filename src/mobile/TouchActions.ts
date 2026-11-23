import type { CDPSession, Locator, Page } from '@playwright/test';

export type SwipeDirection = 'up' | 'down' | 'left' | 'right';
interface Point {
  x: number;
  y: number;
}

/**
 * Real touch gestures for emulated Android (Chromium, `hasTouch: true`). Events are injected through
 * the DevTools protocol, so the page sees genuine touchstart/touchmove/touchend sequences,
 * not mouse events. Requires a Chromium-based project (android-*, mobile-chrome).
 */
export class TouchActions {
  private session: CDPSession | undefined;

  constructor(private readonly page: Page) {}

  private async cdp(): Promise<CDPSession> {
    this.session ??= await this.page.context().newCDPSession(this.page);
    return this.session;
  }

  private async center(target: Locator): Promise<Point> {
    const box = await target.boundingBox();
    if (!box) throw new Error(`Cannot touch ${String(target)}: element is not visible`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }

  private async touch(type: 'touchStart' | 'touchMove' | 'touchEnd', points: Point[]): Promise<void> {
    await (await this.cdp()).send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : points.map((p, id) => ({ x: p.x, y: p.y, id })),
    });
  }

  /** A single tap (Playwright's own, which also checks actionability). */
  async tap(target: Locator): Promise<void> {
    await target.tap();
  }

  async doubleTap(target: Locator): Promise<void> {
    const p = await this.center(target);
    for (let i = 0; i < 2; i++) {
      await this.touch('touchStart', [p]);
      await this.touch('touchEnd', []);
    }
  }

  /** Press and hold. The hold duration is inherent to the gesture, so it is a real timer. */
  async longPress(target: Locator, holdMs = 800): Promise<void> {
    const p = await this.center(target);
    await this.touch('touchStart', [p]);
    await new Promise((r) => setTimeout(r, holdMs));
    await this.touch('touchEnd', []);
  }

  /** Finger drag from the element's centre (or a point) in a direction. */
  async swipe(from: Locator | Point, direction: SwipeDirection, distance = 300, steps = 12): Promise<void> {
    const start = 'x' in from ? from : await this.center(from);
    const delta = {
      up: { x: 0, y: -distance },
      down: { x: 0, y: distance },
      left: { x: -distance, y: 0 },
      right: { x: distance, y: 0 },
    }[direction];

    await this.touch('touchStart', [start]);
    for (let i = 1; i <= steps; i++) {
      await this.touch('touchMove', [{ x: start.x + (delta.x * i) / steps, y: start.y + (delta.y * i) / steps }]);
    }
    await this.touch('touchEnd', []);
  }

  /** Swipe from the middle of the viewport. `up` scrolls the page down, like a real finger. */
  async swipeViewport(direction: SwipeDirection, distance = 300): Promise<void> {
    const size = this.page.viewportSize();
    if (!size) throw new Error('No viewport: use a device project (touch emulation needs one).');
    await this.swipe({ x: size.width / 2, y: size.height / 2 }, direction, distance);
  }

  /** Two-finger pinch around the element's centre. scale > 1 zooms in, < 1 zooms out. */
  async pinch(target: Locator, scale: number, spread = 80, steps = 10): Promise<void> {
    const c = await this.center(target);
    const at = (s: number): Point[] => [
      { x: c.x - s, y: c.y },
      { x: c.x + s, y: c.y },
    ];
    const end = spread * scale;
    await this.touch('touchStart', at(spread));
    for (let i = 1; i <= steps; i++) {
      await this.touch('touchMove', at(spread + ((end - spread) * i) / steps));
    }
    await this.touch('touchEnd', []);
  }

  /** Pull down from the top edge, e.g. pull-to-refresh. */
  async pullToRefresh(distance = 250): Promise<void> {
    const size = this.page.viewportSize();
    if (!size) throw new Error('No viewport');
    await this.swipe({ x: size.width / 2, y: 20 }, 'down', distance);
  }
}
