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

    const TEAM_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    const extractTeamId = (value: string): string | null => {
      const v = value.trim();
      if (!v) return null;

      // Allow pasting a full team URL; take the last segment after /team/
      const idx = v.toLowerCase().lastIndexOf('/team/');
      if (idx !== -1) {
        const after = v.slice(idx + '/team/'.length).split(/[/?#]/)[0];
        if (TEAM_ID_RE.test(after)) return after;
      }

      if (TEAM_ID_RE.test(v)) return v;
      return null;
    };

    let teamFieldKey = 'customfield_10001';
    let isTeamRequired = false;

    // Discover the actual Team field key and whether it is required
    try {
      const metaUrl = `https://${jiraDomain}/rest/api/3/issue/createmeta?projectKeys=${projectKey}&issuetypeNames=${encodeURIComponent(issueTypeName)}&expand=projects.issuetypes.fields`;
      const metaResp = await fetch(metaUrl, {
        method: 'GET',
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: 'application/json',
        },
      });

      if (metaResp.ok) {
        const meta = await metaResp.json();
        const project = meta?.projects?.[0];
        const issuetype = project?.issuetypes?.find((it: any) => it?.name === issueTypeName) ?? project?.issuetypes?.[0];
        const fields = issuetype?.fields ?? {};

        for (const [fieldKey, fieldMeta] of Object.entries(fields)) {
          const fm: any = fieldMeta;
          if (typeof fm?.name === 'string' && fm.name.toLowerCase() === 'team') {
            teamFieldKey = fieldKey;
            isTeamRequired = !!fm?.required;
            break;
          }
        }
      } else {
        const t = await metaResp.text();
        console.warn('Could not fetch Jira create metadata:', metaResp.status, t);
      }
    } catch (e) {
      console.warn('Error fetching Jira create metadata:', e);
    }

    const teamId = extractTeamId(teamInput);

    if (isTeamRequired && !teamId) {
      return new Response(
        JSON.stringify({
          success: false,
          field: 'Team',
          error: 'Jira requires a Team ID to create issues in this project.',
          hint: 'Open the Team page in Jira and copy the last part of the URL after /team/ (it looks like a UUID).',
          exampleTeamId: '36885b3c-1bf0-4f85-a357-c5b858c31de4',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
          ...(teamId ? { [teamFieldKey]: teamId } : {}),
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

    const successful = results.filter((r) => r.jiraKey).length;
    const failed = results.filter((r) => r.error).length;

    return new Response(
      JSON.stringify({
        success: failed === 0,
        successful,
        failed,
        message: `Submitted ${successful} issues to Jira. ${failed} failed.`,
        results,
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
