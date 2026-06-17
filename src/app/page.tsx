import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/sign-out-button";
import { SyncReviewsButton } from "@/components/sync-reviews-button";
import { authOptions } from "@/lib/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <p className="text-lg">Logged in as {session.user?.email}</p>
      <SyncReviewsButton />
      <SignOutButton />
    </div>
  );
}
