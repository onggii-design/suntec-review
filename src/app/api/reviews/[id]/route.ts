import { NextResponse } from "next/server";

import { getAuthenticatedSession, unauthorizedResponse } from "@/lib/auth-server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAuthenticatedSession();
  if (!session) return unauthorizedResponse();

  const body = await request.json();
  const { reply_text } = body as { reply_text: string };

  const supabase = createClient();
  const { error } = await supabase
    .from("reviews")
    .update({ reply_text, reply_status: "draft" })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
