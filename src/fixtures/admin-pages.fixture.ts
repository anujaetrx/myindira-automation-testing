import { MasterDataPage } from '@pages/MasterDataPage';
import { PoliciesPage } from '@pages/PoliciesPage';
import { AcknowledgementsPage } from '@pages/AcknowledgementsPage';
import { CompliancePage } from '@pages/CompliancePage';
import { SocialFeedPage } from '@pages/SocialFeedPage';
import { authTest } from './auth.fixture';

type AdminPageFixtures = {
  /** Master Data page bound to a signed-in ADMIN browser. */
  masterDataPage: MasterDataPage;
  /** Policies page bound to a signed-in ADMIN browser. */
  policiesPage: PoliciesPage;
  /** Acknowledgements page bound to a signed-in ADMIN browser. */
  acknowledgementsPage: AcknowledgementsPage;
  /** Compliance Report page bound to a signed-in ADMIN browser. */
  compliancePage: CompliancePage;
  /** Social Feed page bound to a signed-in ADMIN browser. */
  socialFeedPage: SocialFeedPage;
};

export const adminPagesTest = authTest.extend<AdminPageFixtures>({
  masterDataPage: async ({ adminPage }, use) => use(new MasterDataPage(adminPage)),
  policiesPage: async ({ adminPage }, use) => use(new PoliciesPage(adminPage)),
  acknowledgementsPage: async ({ adminPage }, use) => use(new AcknowledgementsPage(adminPage)),
  compliancePage: async ({ adminPage }, use) => use(new CompliancePage(adminPage)),
  socialFeedPage: async ({ adminPage }, use) => use(new SocialFeedPage(adminPage)),
});
