/**
 * Scopes requested on install. Kept in one place so the authorize URL and
 * the developer-portal app configuration can be diffed against each other.
 */
export function getRequestedScopes(): string {
  return (
    process.env.GHL_SCOPES ??
    [
      "contacts.readonly",
      "opportunities.readonly",
      "calendars.readonly",
      "calendars/events.readonly",
      "invoices.readonly",
      "payments/orders.readonly",
      "payments/transactions.readonly",
      "locations.readonly",
      "users.readonly",
      "oauth.readonly",
      "oauth.write",
    ].join(" ")
  );
}
