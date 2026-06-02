import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

export async function getRequiredSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}
