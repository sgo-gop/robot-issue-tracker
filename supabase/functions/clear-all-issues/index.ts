import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Constant-time string comparison to mitigate timing attacks
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminPassword = Deno.env.get("ADMIN_PASSWORD");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!adminPassword || !supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: "Server not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let body: { password?: unknown } = {};
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const password = typeof body.password === "string" ? body.password : "";
    if (!password || !safeEqual(password, adminPassword)) {
      // Generic message; do not reveal whether password length matched
      return new Response(
        JSON.stringify({ error: "Invalid password" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Collect attachment file paths
    const { data: attachments, error: listErr } = await supabase
      .from("issue_attachments")
      .select("file_path");
    if (listErr) throw listErr;

    const filePaths = (attachments ?? []).map((a: { file_path: string }) => a.file_path);
    if (filePaths.length > 0) {
      const { error: removeErr } = await supabase.storage
        .from("issue-attachments")
        .remove(filePaths);
      if (removeErr) console.warn("Storage remove error:", removeErr);
    }

    const SENTINEL = "00000000-0000-0000-0000-000000000000";
    const { error: attDelErr } = await supabase
      .from("issue_attachments")
      .delete()
      .neq("id", SENTINEL);
    if (attDelErr) throw attDelErr;

    const { error: issueDelErr } = await supabase
      .from("issues")
      .delete()
      .neq("id", SENTINEL);
    if (issueDelErr) throw issueDelErr;

    return new Response(
      JSON.stringify({
        success: true,
        deletedAttachments: filePaths.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("clear-all-issues error:", error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});