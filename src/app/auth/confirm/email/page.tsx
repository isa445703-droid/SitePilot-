import { ConfirmEmailCard } from "@/components/email/confirm-email";

/**
 * Landing page for the link in the confirmation email. The email itself can
 * only contain a URL — the actual confirmation call happens in the card below.
 */
export default async function ConfirmEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <ConfirmEmailCard token={token ?? null} />;
}
