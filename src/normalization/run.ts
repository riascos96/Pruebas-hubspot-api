import { normalizeActivities } from "./activities.js";
import { normalizeCompanies } from "./companies.js";
import { normalizeContacts } from "./contacts.js";
import { log } from "../utils/logger.js";

export async function runNormalization(): Promise<void> {
  await normalizeContacts();
  await normalizeCompanies();
  await normalizeActivities();
  log.info("Normalization completed");
}

if (import.meta.main) {
  runNormalization().catch((err) => {
    console.error("Normalization failed", err);
    process.exitCode = 1;
  });
}
