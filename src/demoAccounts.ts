import { coffeeCompanies, companyIndex } from "./business";
import type { Permissions } from "./userPermissions";

export type AccountProduct =
  | "checking"
  | "savings"
  | "credit_card"
  | "payroll"
  | "merchant_services";

export type DemoCompanyAccount = {
  id: string;
  companyIndex: number;
  product: AccountProduct;
  displayName: string;
};

const productDisplayNames: Record<AccountProduct, string> = {
  checking: "Chase Business Complete Checking",
  savings: "Chase Business Total Savings",
  credit_card: "Ink Business Preferred credit card",
  payroll: "Chase Payroll Services",
  merchant_services: "Chase Merchant Services",
};

/** Stable demo last-four from user + account (not refreshed randomly). */
export function accountLastFour(userId: string, accountId: string): string {
  let hash = 2166136261;
  const key = `${userId}\0${accountId}`;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return String(Math.abs(hash) % 10000).padStart(4, "0");
}

export function formatAccountLabel(
  account: DemoCompanyAccount,
  userId: string,
): string {
  return `${account.displayName} (**${accountLastFour(userId, account.id)})`;
}

function buildCompanyCatalog(companyIdx: number): DemoCompanyAccount[] {
  const mk = (product: AccountProduct, index: number): DemoCompanyAccount => ({
    id: `c${companyIdx}-${product}-${index}`,
    companyIndex: companyIdx,
    product,
    displayName: productDisplayNames[product],
  });

  /** Company → accounts (product mix varies by location). */
  const productsByCompany: AccountProduct[][] = [
    ["checking", "checking", "savings", "credit_card", "payroll", "merchant_services"],
    ["checking", "checking", "savings", "credit_card", "merchant_services"],
    ["checking", "savings", "merchant_services"],
    ["checking", "savings", "payroll", "merchant_services"],
  ];

  const products = productsByCompany[companyIdx] ?? productsByCompany[0];
  const counts: Partial<Record<AccountProduct, number>> = {};
  return products.map((product) => {
    const index = counts[product] ?? 0;
    counts[product] = index + 1;
    return mk(product, index);
  });
}

const catalogByCompany: DemoCompanyAccount[][] = coffeeCompanies.map(
  (_company, idx) => buildCompanyCatalog(idx),
);

export function accountsForCompany(companyIdx: number): DemoCompanyAccount[] {
  return catalogByCompany[companyIdx] ?? catalogByCompany[0];
}

export function allCompanyAccountOptions(companyIdx: number): DemoCompanyAccount[] {
  return accountsForCompany(companyIdx);
}

/** Products selected by default for a role. Account rows stay listed either way. */
export function entitledProductsForRole(role: string): Set<AccountProduct> {
  switch (role) {
    case "Admin":
    case "CFO":
      return new Set([
        "checking",
        "savings",
        "credit_card",
        "payroll",
        "merchant_services",
      ]);
    case "Business Partner":
      return new Set([
        "checking",
        "savings",
        "credit_card",
        "merchant_services",
      ]);
    case "Finance Lead":
      return new Set(["checking", "savings", "payroll"]);
    case "Money Mover":
      return new Set(["checking"]);
    case "Accountant":
      return new Set(["checking", "savings"]);
    case "Read Only":
      return new Set(["checking", "credit_card"]);
    case "Custom":
      return new Set();
    default:
      return new Set(["checking", "credit_card"]);
  }
}

/**
 * Every account at the company stays available to select.
 * Role defaults choose which ones start selected; entitlements do not hide rows.
 */
export function visibleAccountsForUser(
  userId: string,
  _role: string,
  _permissions: Pick<Permissions, "allowed">,
  companyIdx: number = companyIndex(userId),
): DemoCompanyAccount[] {
  return accountsForCompany(companyIdx);
}

function accountSelectedByDefault(
  role: string,
  account: DemoCompanyAccount,
  catalog: DemoCompanyAccount[],
): boolean {
  const known = new Set([
    "Admin",
    "CFO",
    "Business Partner",
    "Finance Lead",
    "Money Mover",
    "Accountant",
    "Read Only",
    "Custom",
  ]);
  const effective = known.has(role) ? role : "Read Only";
  if (!entitledProductsForRole(effective).has(account.product)) return false;
  if (effective === "Money Mover") {
    const checking = catalog.filter((row) => row.product === "checking");
    const index = checking.indexOf(account);
    return index >= 0 && index < 2;
  }
  if (effective === "Read Only") {
    const checking = catalog.filter((row) => row.product === "checking");
    const cards = catalog.filter((row) => row.product === "credit_card");
    if (account.product === "checking") return account.id === checking[0]?.id;
    if (account.product === "credit_card") return account.id === cards[0]?.id;
    return false;
  }
  return true;
}

export function seedAccountAccess(
  userId: string,
  role: string,
  _permissions: Pick<Permissions, "allowed">,
  companyIdx: number = companyIndex(userId),
): Record<string, boolean> {
  const catalog = accountsForCompany(companyIdx);
  return Object.fromEntries(
    catalog.map((account) => [account.id, accountSelectedByDefault(role, account, catalog)]),
  );
}

export function migrateLegacyAccountBooleans(
  legacy: boolean[],
  userId: string,
  role: string,
  permissions: Pick<Permissions, "allowed">,
  companyIdx: number = companyIndex(userId),
): Record<string, boolean> {
  const seeded = seedAccountAccess(userId, role, permissions, companyIdx);
  const ids = Object.keys(seeded);
  return Object.fromEntries(
    ids.map((id, index) => [
      id,
      typeof legacy[index] === "boolean" ? legacy[index] : seeded[id],
    ]),
  );
}
