import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthPanel } from "@/components/auth/auth-panel";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  return <AuthPanel mode="signup" />;
}
