import { coffeeCompanies } from "./business";
import {
  migrateLegacyAccountBooleans,
  seedAccountAccess,
} from "./demoAccounts";

export const statementTypes = [
  "See activity and balances",
  "See check images",
  "See statements and documents",
  "Download statements and documents",
];
export const moneyMovementTypes = [
  "Chase QuickDeposit",
  "ACH payments",
  "ACH vendor payments",
  "Bill pay",
  "CashFlow 360",
  "Transfers and payments",
  "Wires",
  "Zelle",
  "Payroll",
];
/** Money-movement permissions that carry a daily limit. */
export const paymentTypes = moneyMovementTypes;
export const creditCardTypes = ["Card access", "Business credit access"];
export const merchantServiceTypes = [
  "Chase QuickAccept",
  "Mobile Checkout",
  "Payment Solutions",
];
export const permissionNames = [
  ...statementTypes,
  ...moneyMovementTypes,
  ...creditCardTypes,
  ...merchantServiceTypes,
];

export const defaultDailyLimit = "50000.00";

export type Permissions = {
  allowed: Record<string, boolean>;
  limits: Record<string, string>;
  mfa: boolean;
  token: "Soft token" | "Hard token" | "No token";
  accounts: Record<string, boolean>;
};

export type PermissionUser = { id: string; role: string };

export function permissionsForRole(role: string): Omit<Permissions, "accounts"> {
  const enabled = new Set<string>();
  const allow = (...names: string[]) => names.forEach((name) => enabled.add(name));
  const achAndBills = ["ACH payments", "ACH vendor payments", "Bill pay"];
  const movementCore = ["Transfers and payments", "Wires", "Zelle"];
  const partnerServices = [
    "Card access",
    "Business credit access",
    ...merchantServiceTypes,
  ];

  switch (role) {
    case "Admin":
      allow(
        ...statementTypes,
        "Chase QuickDeposit",
        ...achAndBills,
        "CashFlow 360",
        ...movementCore,
        "Payroll",
        ...partnerServices,
      );
      break;
    case "Business Partner":
      allow(
        ...statementTypes,
        "Chase QuickDeposit",
        ...achAndBills,
        "CashFlow 360",
        ...movementCore,
        "Payroll",
        ...partnerServices,
      );
      break;
    case "Finance Lead":
      allow(
        ...statementTypes,
        "Chase QuickDeposit",
        ...achAndBills,
        "CashFlow 360",
        "Payroll",
      );
      break;
    case "Money Mover":
      allow(
        ...statementTypes,
        "Chase QuickDeposit",
        ...achAndBills,
        "CashFlow 360",
        ...movementCore,
        "Payroll",
      );
      break;
    case "Accountant":
      allow(...statementTypes, "Chase QuickDeposit", "CashFlow 360");
      break;
    case "Read Only":
      allow(...statementTypes, "Card access");
      break;
    case "Custom":
      break;
    default:
      allow(...statementTypes, "Card access");
      break;
  }

  return {
    allowed: Object.fromEntries(
      permissionNames.map((name) => [name, enabled.has(name)]),
    ),
    limits: Object.fromEntries(moneyMovementTypes.map((name) => [name, defaultDailyLimit])),
    mfa: true,
    token: "Soft token",
  };
}

export function seedPermissionsForUser(user: PermissionUser): Permissions {
  const base = permissionsForRole(user.role);
  const accounts: Record<string, boolean> = {};
  coffeeCompanies.forEach((_, index) => {
    Object.assign(accounts, seedAccountAccess(user.id, user.role, base, index));
  });
  return { ...base, accounts };
}

export const permissionsStorageKey = (id: string) => `asm-permissions-v2-${id}`;

function isValidAccountMap(
  accounts: unknown,
): accounts is Record<string, boolean> {
  return (
    accounts !== null &&
    typeof accounts === "object" &&
    !Array.isArray(accounts) &&
    Object.values(accounts).every((value) => typeof value === "boolean")
  );
}

type StoredPermissionsBlob = Omit<Permissions, "accounts"> & {
  accounts: Permissions["accounts"] | boolean[];
};

function isValidSavedPermissions(saved: unknown): saved is StoredPermissionsBlob {
  if (!saved || typeof saved !== "object") return false;
  const blob = saved as StoredPermissionsBlob;
  return (
    typeof blob.mfa === "boolean" &&
    ["Soft token", "Hard token", "No token"].includes(blob.token) &&
    permissionNames.every(
      (name) => typeof blob.allowed?.[name] === "boolean",
    ) &&
    moneyMovementTypes.every(
      (name) =>
        typeof blob.limits?.[name] === "string" &&
        Number.isFinite(Number(blob.limits[name])) &&
        Number(blob.limits[name]) >= 0,
    ) &&
    (isValidAccountMap(blob.accounts) ||
      (Array.isArray(blob.accounts) &&
        blob.accounts.length === 4 &&
        blob.accounts.every((value: unknown) => typeof value === "boolean")))
  );
}

export function readStoredPermissions(user: PermissionUser): Permissions {
  const fallback = seedPermissionsForUser(user);
  try {
    const saved = JSON.parse(
      localStorage.getItem(permissionsStorageKey(user.id)) || "null",
    );
    if (!isValidSavedPermissions(saved)) return fallback;

    const accounts = Array.isArray(saved.accounts)
      ? migrateLegacyAccountBooleans(
          saved.accounts,
          user.id,
          user.role,
          saved,
        )
      : saved.accounts;

    const { approvals: _approvals, ...rest } = saved as StoredPermissionsBlob & {
      approvals?: unknown;
    };
    return { ...rest, accounts };
  } catch {
    return fallback;
  }
}
