import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { WaitlistAction } from "./waitlist-action";

export const metadata: Metadata = {
  title: "Warteliste",
  robots: { index: false },
};

// Target of the links in the confirmation mail: ?token=…[&aktion=abmelden]
export default function WaitlistPage({
  searchParams,
}: {
  searchParams: { token?: string; aktion?: string };
}) {
  const { token, aktion } = searchParams;
  const action = aktion === "abmelden" ? "unsubscribe" : "confirm";

  return (
    <LegalPage title={action === "unsubscribe" ? "Von der Warteliste abmelden" : "Anmeldung bestätigen"}>
      <WaitlistAction token={token ?? ""} action={action} />
    </LegalPage>
  );
}
