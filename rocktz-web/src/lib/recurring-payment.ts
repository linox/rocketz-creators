export type RecurringPaymentMode = "cash" | "barter" | "mixed";

export function recurringPaymentMode(value?: string | null): RecurringPaymentMode {
  if (value === "barter" || value === "mixed") return value;
  return "cash";
}

export function recurringAllowsCash(mode: RecurringPaymentMode) {
  return mode !== "barter";
}

export function recurringAllowsBarter(mode: RecurringPaymentMode) {
  return mode !== "cash";
}
