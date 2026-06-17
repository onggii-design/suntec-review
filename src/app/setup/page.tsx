import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { SetupClient } from "@/app/setup/setup-client";
import { authOptions } from "@/lib/auth";

export default async function SetupPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <SetupClient />
    </div>
  );
}
