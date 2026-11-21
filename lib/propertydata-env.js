// PropertyData has been configured under two env names. Callers keep their
// historical name first so an existing Vercel value is never overridden, and
// the other name is only used when the preferred one is missing.
export function propertyDataKey(prefer = "PROPERTYDATA_API_KEY") {
  const apiKey = String(process.env.PROPERTYDATA_API_KEY || "").trim();
  const legacyKey = String(process.env.PROPERTYDATA_KEY || "").trim();
  if (prefer === "PROPERTYDATA_KEY") return legacyKey || apiKey;
  return apiKey || legacyKey;
}
