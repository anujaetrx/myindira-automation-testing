import type { Locator, Page } from '@playwright/test';
import { HeaderComponent } from '@components/common/Header.component';
import { SidebarComponent } from '@components/common/Sidebar.component';
import { BasePage } from './BasePage';

/** Icon-font glyphs live in the private-use area and count as "text"; remove them before comparing. */
const clean = (t: string): string => t.replace(/[-]|[\u{F0000}-\u{FFFFD}]/gu, '').replace(/\s+/g, ' ').trim();

/** GET /admin/dashboard (observed on QA). */
export interface DashboardAtRisk {
  policyId: number;
  policyTitle: string;
  deadline: string;
  totalAssigned: number;
  totalAcknowledged: number;
  compliancePercentage: number;
  status: 'OVERDUE' | 'AT_RISK' | string;
}
export interface DashboardData {
  totalUsers: number;
  totalStudents: number;
  totalEmployees: number;
  totalAdmins: number;
  policiesPublished: number;
  ackRequestsPublished: number;
  overallCompliance: number;
  atRiskPolicies: DashboardAtRisk[];
}

export const DASHBOARD_API = /\/admin\/dashboard(\?|$)/;

/** Builds a complete dashboard payload by hand (never fetched from the server) for mocking. */
export function dashboardData(over: Partial<DashboardData> = {}): DashboardData {
  return {
    totalUsers: 10,
    totalStudents: 6,
    totalEmployees: 3,
    totalAdmins: 1,
    policiesPublished: 2,
    ackRequestsPublished: 1,
    overallCompliance: 0,
    atRiskPolicies: [],
    ...over,
  };
}
export const dashboardResponse = (data: Partial<DashboardData> = {}): object => ({
  success: true,
  message: 'Admin dashboard fetched',
  code: 'OK',
  data: dashboardData(data),
});

export interface RiskCard {
  title: string;
  counter: string; // "6/2509 acknowledged"
  status: string; // "OVERDUE" | "AT_RISK"
  pillColor: string;
  barScale: number; // progress bar fill scaleX (0..1)
  text: string; // everything the card shows, for "no percentage text" checks
}

/**
 * Admin Dashboard ("Admin Dashboard / Indira University Overview"): six KPI tiles, an Overall Compliance card
 * with a tier badge, and one card per at-risk policy (counter, status pill, progress bar).
 * Cards are all `data-testid="card"`: 6 tiles, then the compliance card, then the at-risk cards.
 * Interactions only: expectations live in the specs.
 */
export class DashboardPage extends BasePage {
  protected readonly path = '/dashboard';

  // Reusable components are composed, not inherited.
  readonly header: HeaderComponent;
  readonly sidebar: SidebarComponent;
  private readonly pageHeading: Locator;

  constructor(page: Page) {
    super(page);
    this.header = new HeaderComponent(page);
    this.sidebar = new SidebarComponent(page);
    // Observed on QA: the admin landing page shows "Admin Dashboard" with the left menu.
    this.pageHeading = page.getByText('Admin Dashboard').first();
  }

  async waitForReady(): Promise<void> {
    await this.waits.forVisible(this.pageHeading);
  }

  async expectLoaded(): Promise<void> {
    await this.verify.url(/\/dashboard/);
    await this.verify.visible(this.pageHeading, 'dashboard heading should be visible');
  }

  /** Side-menu entry (tablet/desktop). On phones Master Data sits under the "More" tab. */
  async openMasterData(): Promise<void> {
    await this.actions.click(this.page.getByText('Master Data', { exact: true }).first(), 'Master Data menu item');
  }

  async openProfile(): Promise<void> {
    await this.sidebar.navigateTo(/profile/i);
  }

  /**
   * The feed entry point. Tablets/desktop show a side menu ("Social Feed"); phones show a bottom tab
   * bar where the same item is labelled "Feed".
   */
  get feedMenuItem(): Locator {
    return this.page.getByText(/^(Social Feed|Feed)$/).filter({ visible: true }).first();
  }

  get headingLocator(): Locator {
    return this.pageHeading;
  }

  // ---------- real-app locators ----------
  get subtitle(): Locator {
    return this.page.getByText('Indira University Overview', { exact: true });
  }
  get loader(): Locator {
    return this.page.getByRole('progressbar').first();
  }
  get cards(): Locator {
    return this.page.getByTestId('card');
  }
  section(title: string): Locator {
    return this.page.getByText(title, { exact: true });
  }
  sidebarItem(label: string): Locator {
    return this.page.getByText(label, { exact: true }).first();
  }

  /** The six KPI tiles as label -> value text, e.g. { Total: "2519", Policies: "10" }. */
  async tiles(): Promise<Record<string, string>> {
    const texts = await this.cards.allInnerTexts();
    const out: Record<string, string> = {};
    for (const raw of texts) {
      const m = /^(\d+)\s+([A-Za-z ]+)$/.exec(clean(raw));
      if (m) out[m[2]] = m[1];
    }
    return out;
  }

  /** Overall Compliance card: the big number text, the tier badge text/colour and the bar. */
  async compliance(): Promise<{ text: string; badge: string; badgeColor: string; barScale: number; barColor: string } | null> {
    return this.page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[data-testid=card]')) as HTMLElement[];
      const card = cards.find((c) => /%/.test(c.innerText) && !/acknowledged/.test(c.innerText));
      if (!card) return null;
      const leaves = Array.from(card.querySelectorAll('div')).filter((d) => d.children.length === 0 && (d as HTMLElement).innerText) as HTMLElement[];
      const pct = leaves.find((d) => /%$/.test(d.innerText));
      const badge = leaves.find((d) => !/%$/.test(d.innerText));
      const fill = card.querySelector('[data-testid=progress-bar-fill]') as HTMLElement | null;
      const m = /scaleX\(([\d.e-]+)\)/.exec(fill?.style.transform ?? '');
      return {
        text: pct?.innerText ?? '',
        badge: badge?.innerText ?? '',
        badgeColor: badge ? getComputedStyle(badge).backgroundColor : '',
        barScale: m ? Number(m[1]) : NaN,
        barColor: fill ? fill.style.backgroundColor : '',
      };
    });
  }

  /** At-risk policy cards in screen order. */
  async riskCards(): Promise<RiskCard[]> {
    return this.page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[data-testid=card]')) as HTMLElement[];
      return cards
        .filter((c) => /acknowledged/.test(c.innerText))
        .map((c) => {
          const lines = c.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
          const pill = Array.from(c.querySelectorAll('div')).find((d) => d.children.length === 0 && /^(OVERDUE|AT_RISK)$/.test((d as HTMLElement).innerText)) as HTMLElement | undefined;
          const fill = c.querySelector('[data-testid=progress-bar-fill]') as HTMLElement | null;
          const m = /scaleX\(([\d.e-]+)\)/.exec(fill?.style.transform ?? '');
          return {
            title: lines[0] ?? '',
            counter: lines.find((l) => /acknowledged/.test(l)) ?? '',
            status: pill?.innerText ?? '',
            pillColor: pill ? getComputedStyle(pill).backgroundColor : '',
            barScale: m ? Number(m[1]) : NaN,
            text: c.innerText.replace(/\s+/g, ' ').trim(),
          };
        });
    });
  }

  riskCard(title: string): Locator {
    return this.cards.filter({ hasText: title }).first();
  }

  // ---------- user menu / sign out ----------
  /** Round initials avatar in the top bar (e.g. "IK"). */
  get avatar(): Locator {
    return this.page.getByText(/^[A-Z]{2}$/).filter({ visible: true }).last();
  }
  get logoutItem(): Locator {
    return this.page.getByText('Logout', { exact: true });
  }

  async openUserMenu(): Promise<void> {
    await this.avatar.click();
    await this.logoutItem.waitFor({ state: 'visible' });
  }
  /** Opens the user menu and the "Sign Out" confirmation (a custom modal, not a native dialog). */
  async openSignOutDialog(): Promise<void> {
    await this.openUserMenu();
    await this.logoutItem.click({ force: true });
    await this.page.getByText('Are you sure you want to sign out?', { exact: false }).waitFor({ state: 'visible' });
  }
  async cancelSignOut(): Promise<void> {
    await this.page.getByText('Cancel', { exact: true }).click({ force: true });
  }
  async confirmSignOut(): Promise<void> {
    await this.page.getByText('Sign Out', { exact: true }).last().click({ force: true });
  }
  get signOutPrompt(): Locator {
    return this.page.getByText('Are you sure you want to sign out?', { exact: false });
  }
}
