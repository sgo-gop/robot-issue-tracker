import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Issue {
  id: string;
  issue_number: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  category: string;
  steps_to_reproduce?: string;
  expected_behavior?: string;
  actual_behavior?: string;
  stations?: { name: string } | null;
  software_versions?: { version: string } | null;
  created_at: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { issues, team } = await req.json() as { issues: Issue[]; team?: string | null };
    
    const jiraEmail = Deno.env.get('JIRA_EMAIL');
    const jiraApiToken = Deno.env.get('JIRA_API_TOKEN');
    const jiraDomain = 'neurarobotics.atlassian.net';
    const projectKey = 'NEURA';

    if (!jiraEmail || !jiraApiToken) {
      console.error('Missing Jira credentials');
      return new Response(
        JSON.stringify({ error: 'Jira credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const auth = btoa(`${jiraEmail}:${jiraApiToken}`);
    const results: { issueId: string; jiraKey?: string; error?: string }[] = [];

    const issueTypeName = 'Task';
    const teamInput = typeof team === 'string' ? team.trim() : '';

    type AllowedValue = { id?: string; name?: string; value?: string };

    const optionToFieldValue = (opt: AllowedValue | string) => {
      if (typeof opt === 'string') return opt;
      if (opt.id) return { id: opt.id };
      if (opt.value) return { value: opt.value };
      if (opt.name) return { value: opt.name };
      return opt;
    };

    let teamFieldKey: string | null = null;
    let teamAllowedValues: AllowedValue[] = [];
    let teamFieldValue: unknown | null = null;

    // Discover required fields (like Team) via create metadata
    try {
      const metaUrl = `https://${jiraDomain}/rest/api/3/issue/createmeta?projectKeys=${projectKey}&issuetypeNames=${encodeURIComponent(issueTypeName)}&expand=projects.issuetypes.fields`;
      const metaResp = await fetch(metaUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
        },
      });

      if (metaResp.ok) {
        const meta = await metaResp.json();
        const project = meta?.projects?.[0];
        const issuetype = project?.issuetypes?.find((it: any) => it?.name === issueTypeName) ?? project?.issuetypes?.[0];
        const fields = issuetype?.fields ?? {};

        for (const [fieldKey, fieldMeta] of Object.entries(fields)) {
          const fm: any = fieldMeta;
          if (fm?.required && typeof fm?.name === 'string' && fm.name.toLowerCase() === 'team') {
            teamFieldKey = fieldKey;
            teamAllowedValues = Array.isArray(fm.allowedValues) ? (fm.allowedValues as AllowedValue[]) : [];
            break;
          }
        }

        if (teamFieldKey) {
          if (teamAllowedValues.length > 0) {
            if (!teamInput) {
              if (teamAllowedValues.length === 1) {
                teamFieldValue = optionToFieldValue(teamAllowedValues[0]);
              } else {
                return new Response(
                  JSON.stringify({
                    error: 'Jira requires a Team for this project. Please enter a Team and retry.',
                    field: 'Team',
                    options: teamAllowedValues.map(v => v.name ?? v.value ?? v.id).filter(Boolean),
                  }),
                  { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
            } else {
              const match = teamAllowedValues.find(v => (v.name ?? v.value ?? '').toLowerCase() === teamInput.toLowerCase());
              if (!match) {
                return new Response(
                  JSON.stringify({
                    error: `Team "${teamInput}" was not found in Jira options.`,
                    field: 'Team',
                    options: teamAllowedValues.map(v => v.name ?? v.value ?? v.id).filter(Boolean),
                  }),
                  { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
              teamFieldValue = optionToFieldValue(match);
            }
          } else {
            // No options returned; still try with the provided value, otherwise fail early.
            if (!teamInput) {
              return new Response(
                JSON.stringify({
                  error: 'Jira requires a Team for this project, but no selectable options were returned. Please enter a Team value and retry.',
                  field: 'Team',
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
            teamFieldValue = teamInput;
          }
        }
      } else {
        const t = await metaResp.text();
        console.warn('Could not fetch Jira create metadata:', metaResp.status, t);
      }
    } catch (e) {
      console.warn('Error fetching Jira create metadata:', e);
    }

    for (const issue of issues) {

      // Build description with all relevant info
      const descriptionParts = [
        `*Issue ID:* ${issue.issue_number}`,
        `*Category:* ${issue.category}`,
        `*Status:* ${issue.status}`,
        issue.stations?.name ? `*Station:* ${issue.stations.name}` : null,
        issue.software_versions?.version ? `*Software Version:* ${issue.software_versions.version}` : null,
        `*Created:* ${new Date(issue.created_at).toLocaleString()}`,
        '',
        '*Description:*',
        issue.description,
      ];

      if (issue.steps_to_reproduce) {
        descriptionParts.push('', '*Steps to Reproduce:*', issue.steps_to_reproduce);
      }
      if (issue.expected_behavior) {
        descriptionParts.push('', '*Expected Behavior:*', issue.expected_behavior);
      }
      if (issue.actual_behavior) {
        descriptionParts.push('', '*Actual Behavior:*', issue.actual_behavior);
      }

      const jiraPayload = {
        fields: {
          project: { key: projectKey },
          summary: `[${issue.issue_number}] ${issue.title}`,
          description: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: descriptionParts.filter(Boolean).join('\n'),
                  },
                ],
              },
            ],
          },
          issuetype: { name: issueTypeName },
          ...(teamFieldKey && teamFieldValue ? { [teamFieldKey]: teamFieldValue } : {}),
          labels: [issue.category, 'lovable-import'],
        },
      };

      console.log(`Submitting issue ${issue.issue_number} to Jira...`);

      try {
        const response = await fetch(`https://${jiraDomain}/rest/api/3/issue`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(jiraPayload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Jira API error for ${issue.issue_number}:`, response.status, errorText);
          results.push({ issueId: issue.id, error: `Jira ${response.status}: ${errorText}` });
        } else {
          const jiraResponse = await response.json();
          console.log(`Successfully created Jira issue ${jiraResponse.key} for ${issue.issue_number}`);
          results.push({ issueId: issue.id, jiraKey: jiraResponse.key });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error submitting ${issue.issue_number}:`, error);
        results.push({ issueId: issue.id, error: errorMessage });
      }
    }

    const successful = results.filter(r => r.jiraKey).length;
    const failed = results.filter(r => r.error).length;

    return new Response(
      JSON.stringify({ 
        message: `Submitted ${successful} issues to Jira. ${failed} failed.`,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in submit-to-jira function:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
