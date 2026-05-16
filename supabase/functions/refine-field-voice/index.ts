import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FIELD_GUIDANCE: Record<string, string> = {
  description:
    "A clear, concise description of the issue. Use complete sentences. Preserve all technical details, error messages, component names, and numbers exactly as spoken.",
  steps_to_reproduce:
    "An ordered, numbered list of steps (1., 2., 3., ...). Each step should be a short imperative sentence. Infer ordering from words like 'first', 'then', 'next', 'after that', 'finally'.",
  expected_behavior:
    "A short statement of what the robot/system should do. Use clear declarative sentences.",
  actual_behavior:
    "A short statement of what actually happened. Use clear declarative sentences. Preserve error codes and observations exactly.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { transcript, field, existing } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    if (!transcript || typeof transcript !== "string") {
      return new Response(JSON.stringify({ text: existing || "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const guidance = FIELD_GUIDANCE[field] || "A clear, well-formatted text.";
    const systemPrompt = `You refine raw speech-to-text transcripts for a robot bug tracking system into a polished value for the "${field}" field of an issue report.

Format: ${guidance}

Rules:
- Fix punctuation, capitalization, grammar, and obvious speech-recognition errors (e.g. "to" vs "two", "their" vs "there").
- Preserve ALL technical content: numbers, units, error codes, component names, model names, version numbers.
- Do NOT invent facts that were not spoken. Do NOT add commentary, headings, or labels like "Description:".
- If existing text is provided, merge the new transcript naturally with it (append, don't repeat).
- Output ONLY the final refined text for the field — no quotes, no markdown wrapping, no preamble.`;

    const userContent = existing
      ? `Existing text in field:\n"""${existing}"""\n\nNew voice transcript to merge in:\n"""${transcript}"""`
      : `Voice transcript:\n"""${transcript}"""`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const text = (data.choices?.[0]?.message?.content || "").trim();
    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("refine-field-voice error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});