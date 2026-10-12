export const businessRoles = [
  "Admin",
  "CFO",
  "Business Partner",
  "Finance Lead",
  "Money Mover",
  "Accountant",
  "Read Only",
  "Custom",
];
export const roleDescriptions: Record<string, string> = {
  Admin: "Full access to manage business accounts, payments, and users.",
  CFO: "Full access to financial accounts, payments, and reporting.",
  "Business Partner": "Can access business accounts, cards, and payment processing services.",
  "Finance Lead": "Can manage day-to-day finances, payments, and payroll.",
  "Money Mover": "Can make payments and transfers from authorized accounts.",
  Accountant: "Can view financial information, deposit checks, and manage cash flow.",
  "Read Only": "Can view accounts and transactions and can be issued cards.",
  Custom: "Choose specific permissions and account access based on the employee’s responsibilities.",
};
export function normalizeRole(role: string) {
  if (businessRoles.includes(role)) return role;
  const previousRoles: Record<string, string> = {
    Owner: "Admin", "Business partner": "Business Partner", "Co-owner": "Admin", "Co-Owner": "Admin",
    "Finance Manager": "Finance Lead", "Finance manager": "Finance Lead", "Finance lead": "Finance Lead",
    "Operations manager": "Finance Lead", Bookkeeper: "Finance Lead", "Store manager": "Money Mover",
    "Assistant store manager": "Money Mover", "Shift supervisor": "Money Mover",
    "Accounts payable": "Money Mover", "Payroll specialist": "Money Mover",
  };
  return previousRoles[role] || "Read Only";
}
export const coffeeCompanies = [
  { name: "Bean & Branch", location: "Head office" },
  { name: "Bean & Branch", location: "Downtown" },
  { name: "Bean & Branch", location: "Riverside" },
  { name: "Bean & Branch", location: "Roastery" },
];
export function companyIndex(userId: string) {
  if (["69032", "69037", "69038"].includes(userId)) return 1;
  if (userId === "69039") return 2;
  if (!/^690(29|30|31|33|34|35|36|40|41)$/.test(userId)) return 3;
  return 0;
}
export function companyLabel(userId: string) {
  const company = coffeeCompanies[companyIndex(userId)];
  return `${company.name} · ${company.location}`;
}

export const userStatuses = ["Active", "Invited", "Needs approval", "Deactivated", "Removed"];
export function statusClass(status: string) {
  return isInactive(status) ? "removed" : status === "Invited" ? "invited" : status === "Needs approval" ? "pending" : "";
}

export function isInactive(status: string) { return status === "Removed" || status === "Deactivated"; }
