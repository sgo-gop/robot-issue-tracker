import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an assistant that extracts structured issue report data from spoken text.
    
Extract the following fields from the user's spoken description:
- title: A brief title for the issue (max 200 chars)
- priority: One of "low", "medium", "high", "critical" (default to "medium" if unclear)
- category: One of "hardware", "software", "mechanical", "electrical", "other" (default to "other" if unclear)
- steps_to_reproduce: Detailed description and steps to reproduce the issue
- expected_behavior: What should happen (if mentioned)
- actual_behavior: What actually happened (if mentioned)

Return ONLY valid JSON with these fields. If a field wasn't mentioned, use empty string for text fields.`;

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
          { role: "user", content: transcript },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_issue_data",
              description: "Extract structured issue data from spoken text",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Brief issue title" },
                  priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
                  category: { type: "string", enum: ["hardware", "software", "mechanical", "electrical", "other"] },
                  steps_to_reproduce: { type: "string", description: "Detailed description and steps to reproduce" },
                  expected_behavior: { type: "string", description: "Expected behavior" },
                  actual_behavior: { type: "string", description: "Actual behavior" },
                },
                required: ["title", "steps_to_reproduce", "priority", "category"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_issue_data" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    console.log("AI response:", JSON.stringify(data, null, 2));

    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsedData = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(parsedData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Failed to parse AI response");
  } catch (error) {
    console.error("parse-issue-voice error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
