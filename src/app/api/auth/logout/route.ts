import { destroySession } from "@/lib/auth/session";
import { handleApi } from "@/lib/api/http";

export async function POST() {
  return handleApi(async () => {
    await destroySession();
    return { signedOut: true };
  });
}
