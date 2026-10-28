// Operator details for Impressum and Datenschutzerklärung. Fill in every
// [PLATZHALTER] before the site goes public, and have both texts checked
// (e.g. with a generator like eRecht24 or by a lawyer) before you start selling.

export const OPERATOR = {
  name: "[PLATZHALTER: Vor- und Nachname]",
  street: "[PLATZHALTER: Straße und Hausnummer]",
  city: "[PLATZHALTER: PLZ und Ort]",
  country: "Deutschland",
  email: "[PLATZHALTER: kontakt@deine-domain.de]",
  // Only once you have one; leave null until then.
  vatId: null as string | null,
};

// Where Supabase stores the data; pick the region of your project.
export const SUPABASE_REGION = "[PLATZHALTER: z. B. Frankfurt, EU (eu-central-1)]";

export const LEGAL_UPDATED = "Oktober 2026";
