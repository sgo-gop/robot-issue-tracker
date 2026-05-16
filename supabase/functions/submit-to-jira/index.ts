import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  robot_type?: string | null;
  software_versions?: { version: string } | null;
  created_at: string;
  jira_issue_key?: string | null;
}

interface Attachment {
  id: string;
  issue_id: string;
  file_name: string;
  file_path: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { issues, team, projectKey: requestedProjectKey } = await req.json() as { issues: Issue[]; team?: string | null; projectKey?: string | null };
    
    const jiraEmail = Deno.env.get('JIRA_EMAIL');
    const jiraApiToken = Deno.env.get('JIRA_API_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const jiraDomain = 'neurarobotics.atlassian.net';
    const ALLOWED_PROJECT_KEYS = ['SAIR', 'NEURA'];
    const projectKey = (typeof requestedProjectKey === 'string' && ALLOWED_PROJECT_KEYS.includes(requestedProjectKey.toUpperCase()))
      ? requestedProjectKey.toUpperCase()
      : 'SAIR';

    if (!jiraEmail || !jiraApiToken) {
      console.error('Missing Jira credentials');
      return new Response(
        JSON.stringify({ error: 'Jira credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials');
      return new Response(
        JSON.stringify({ error: 'Supabase credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const auth = btoa(`${jiraEmail}:${jiraApiToken}`);
    const results: { issueId: string; jiraKey?: string; error?: string; attachmentsUploaded?: number; skipped?: boolean }[] = [];

    const fetchJiraDiagnostic = async () => {
      const diagnostic: Record<string, unknown> = {
        configuredEmail: jiraEmail,
        projectKey,
      };

      try {
        const myselfResp = await fetch(`https://${jiraDomain}/rest/api/3/myself`, {
          headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
        });
        const myselfText = await myselfResp.text();
        diagnostic.myselfStatus = myselfResp.status;
        if (myselfResp.ok) {
          const myself = JSON.parse(myselfText);
          diagnostic.jiraAccount = {
            accountId: myself.accountId,
            displayName: myself.displayName,
            emailAddress: myself.emailAddress ?? null,
            active: myself.active,
          };
        } else {
          diagnostic.myselfError = myselfText.slice(0, 500);
        }
      } catch (error) {
        diagnostic.myselfError = error instanceof Error ? error.message : String(error);
      }

      try {
        const permissionsUrl = `https://${jiraDomain}/rest/api/3/mypermissions?projectKey=${encodeURIComponent(projectKey)}&permissions=BROWSE_PROJECTS,CREATE_ISSUES`;
        const permissionsResp = await fetch(permissionsUrl, {
          headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
        });
        const permissionsText = await permissionsResp.text();
        diagnostic.permissionsStatus = permissionsResp.status;
        if (permissionsResp.ok) {
          const permissions = JSON.parse(permissionsText)?.permissions ?? {};
          diagnostic.permissions = {
            BROWSE_PROJECTS: !!permissions.BROWSE_PROJECTS?.havePermission,
            CREATE_ISSUES: !!permissions.CREATE_ISSUES?.havePermission,
          };
        } else {
          diagnostic.permissionsError = permissionsText.slice(0, 500);
        }
      } catch (error) {
        diagnostic.permissionsError = error instanceof Error ? error.message : String(error);
      }

      return diagnostic;
    };

    // Safe credential metadata logging (never log full token).
    console.log('Jira config:', {
      domain: jiraDomain,
      projectKey,
      emailConfigured: !!jiraEmail,
      emailDomain: jiraEmail?.split('@')[1] || null,
      tokenLength: jiraApiToken?.length || 0,
      tokenSuffix: jiraApiToken ? jiraApiToken.slice(-4) : null,
    });

    // Do not preflight with /myself or /project here: Jira scoped API tokens can fail
    // on some read endpoints while still being usable for the issue-create endpoint.
    // Let the actual create request determine whether auth, permissions, or fields fail.

    // SAIR uses issuetype id 10009 (Bug, per SAIR spec); NEURA stays as Task.
    const isSair = projectKey === 'SAIR';
    const issueTypeName = 'Task'; // used for NEURA + error messages
    const sairIssueTypeId = '10009';

    // SAIR custom field IDs (from SAIR spec)
    const SAIR_FIELDS = {
      product: 'customfield_10161',
      controlSoftwareVersion: 'customfield_10506',
      guiVersion: 'customfield_10507',
      aiVersion: 'customfield_10508',
      reproSteps: 'customfield_10509',
      expectedResults: 'customfield_10704',
      actualResults: 'customfield_10705',
      driveFirmware: 'customfield_12816',
      safetyLogic: 'customfield_12817',
      safetyFirmware: 'customfield_12818',
    } as const;

    // Map robot_type → SAIR Product option id
    const sairProductOptionForRobot = (robot?: string | null): string | null => {
      if (!robot) return null;
      const r = robot.toUpperCase();
      if (r.includes('LARA')) return '10444';        // LARA Classic
      if (r.includes('MAIRA')) return '10445';       // MAiRA
      if (r.includes('MAV')) return '10446';         // MAV
      if (r.includes('4NE-1') || r.includes('4NE1')) return '13673'; // 4NE-1
      if (r.includes('MIPA')) return '13672';        // MiPA
      if (r.includes('VALUE')) return '13674';       // Value Line
      return '10447';                                 // Other
    };

    // Map our priority → Jira priority id (SAIR) / name (NEURA)
    const jiraPriorityId = (p?: string | null): string => {
      switch ((p || '').toLowerCase()) {
        case 'critical': return '1'; // Highest
        case 'high': return '2';     // High
        case 'medium': return '3';   // Medium
        case 'low': return '4';      // Low
        default: return '3';
      }
    };
    const jiraPriorityName = (p?: string | null): string => {
      switch ((p || '').toLowerCase()) {
        case 'critical': return 'Highest';
        case 'high': return 'High';
        case 'medium': return 'Medium';
        case 'low': return 'Low';
        default: return 'Medium';
      }
    };

    // Default Team ID for NEURA project
    const DEFAULT_TEAM_ID = 'fe36c533-9a84-4d9b-b674-68079b4c4073';
    const teamInput = typeof team === 'string' && team.trim() ? team.trim() : DEFAULT_TEAM_ID;

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

    // SAIR does not use the Team field — only NEURA needs a Team ID.
    if (!isSair) try {
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

    const teamId = isSair ? null : extractTeamId(teamInput);

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

    // Fetch all attachments for these issues
    const issueIds = issues.map(i => i.id);
    const { data: allAttachments, error: attError } = await supabase
      .from('issue_attachments')
      .select('*')
      .in('issue_id', issueIds);

    if (attError) {
      console.warn('Error fetching attachments:', attError);
    }

    // Group attachments by issue_id
    const attachmentsByIssue: Record<string, Attachment[]> = {};
    (allAttachments || []).forEach((att: Attachment) => {
      if (!attachmentsByIssue[att.issue_id]) {
        attachmentsByIssue[att.issue_id] = [];
      }
      attachmentsByIssue[att.issue_id].push(att);
    });

    console.log(`Found ${allAttachments?.length || 0} total attachments for ${issueIds.length} issues`);

    for (const issue of issues) {
      // Skip issues that already have a Jira key
      if (issue.jira_issue_key) {
        console.log(`Skipping issue ${issue.issue_number} - already synced as ${issue.jira_issue_key}`);
        results.push({ issueId: issue.id, jiraKey: issue.jira_issue_key, skipped: true });
        continue;
      }

      // Build description with all relevant info
      const descriptionParts = [
        `*Issue ID:* ${issue.issue_number}`,
        `*Category:* ${issue.category}`,
        `*Status:* ${issue.status}`,
        issue.robot_type ? `*Robot:* ${issue.robot_type}` : null,
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

      const baseFields: Record<string, unknown> = {
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
        issuetype: isSair ? { id: sairIssueTypeId } : { name: issueTypeName },
        priority: isSair
          ? { id: jiraPriorityId(issue.priority) }
          : { name: jiraPriorityName(issue.priority) },
        ...(isSair ? {} : { labels: [issue.category, 'lovable-import'] }),
        ...(teamId ? { [teamFieldKey]: teamId } : {}),
      };

      if (isSair) {
        const productId = sairProductOptionForRobot(issue.robot_type);
        if (productId) baseFields[SAIR_FIELDS.product] = { id: productId };
        // Jira requires Control Software Version. We only track one version in
        // the app, so use it for control/gui/ai. Fallback to "N/A" if missing.
        const versionValue = issue.software_versions?.version || 'N/A';
        baseFields[SAIR_FIELDS.controlSoftwareVersion] = versionValue;
        baseFields[SAIR_FIELDS.guiVersion] = versionValue;
        baseFields[SAIR_FIELDS.aiVersion] = versionValue;
        const toAdf = (text: string) => ({
          type: 'doc',
          version: 1,
          content: [
            { type: 'paragraph', content: [{ type: 'text', text }] },
          ],
        });
        if (issue.steps_to_reproduce) {
          baseFields[SAIR_FIELDS.reproSteps] = toAdf(issue.steps_to_reproduce);
        }
        if (issue.expected_behavior) {
          baseFields[SAIR_FIELDS.expectedResults] = issue.expected_behavior;
        }
        if (issue.actual_behavior) {
          baseFields[SAIR_FIELDS.actualResults] = issue.actual_behavior;
        }
      }

      const jiraPayload = { fields: baseFields };

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
          const diagnostic = await fetchJiraDiagnostic();
          console.error(`Jira diagnostic for ${issue.issue_number}:`, JSON.stringify(diagnostic));
          const permissionDenied = /无权|permission|permissions|not permitted|not authorized|cannot create|create issues/i.test(errorText);
          const typeLabel = isSair ? 'Bug' : issueTypeName;
          const diagnosticText = ` Diagnostic: ${JSON.stringify(diagnostic)}`;
          const friendly = permissionDenied
            ? `Jira permission error: Jira says the configured account cannot create ${typeLabel} issues in project ${projectKey}. Check the account in the diagnostic and grant that exact account Browse project + Create issues for ${projectKey}. Raw: ${errorText}${diagnosticText}`
            : response.status === 401
            ? `Jira 401: Jira rejected authentication while creating ${typeLabel} in ${projectKey}. Verify the Jira email matches the API token owner. Raw: ${errorText}${diagnosticText}`
            : response.status === 403
            ? `Jira 403: account lacks permission to create ${typeLabel} in ${projectKey}. Grant the diagnostic account "Browse project" and "Create issues" permission. Raw: ${errorText}${diagnosticText}`
            : `Jira ${response.status}: ${errorText}${diagnosticText}`;
          results.push({ issueId: issue.id, error: friendly });
        } else {
          const jiraResponse = await response.json();
          const jiraKey = jiraResponse.key;
          console.log(`Successfully created Jira issue ${jiraKey} for ${issue.issue_number}`);
          
          // Save the Jira key to the database to prevent duplicate submissions
          const { error: updateError } = await supabase
            .from('issues')
            .update({ jira_issue_key: jiraKey })
            .eq('id', issue.id);
          
          if (updateError) {
            console.warn(`Failed to save Jira key for issue ${issue.id}:`, updateError);
          } else {
            console.log(`Saved Jira key ${jiraKey} for issue ${issue.id}`);
          }
          
          // Now upload attachments for this issue
          const issueAttachments = attachmentsByIssue[issue.id] || [];
          let attachmentsUploaded = 0;

          for (const attachment of issueAttachments) {
            try {
              console.log(`Downloading attachment ${attachment.file_name} from storage...`);
              
              // Download file from Supabase Storage
              const { data: fileData, error: downloadError } = await supabase.storage
                .from('issue-attachments')
                .download(attachment.file_path);

              if (downloadError || !fileData) {
                console.error(`Failed to download attachment ${attachment.file_name}:`, downloadError);
                continue;
              }

              // Convert blob to ArrayBuffer for upload
              const arrayBuffer = await fileData.arrayBuffer();
              const uint8Array = new Uint8Array(arrayBuffer);

              // Create form data for Jira attachment upload
              // Jira expects multipart/form-data with X-Atlassian-Token: no-check
              const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
              
              // Build multipart body manually
              const encoder = new TextEncoder();
              const contentDisposition = `Content-Disposition: form-data; name="file"; filename="${attachment.file_name}"`;
              const contentType = `Content-Type: application/octet-stream`;
              
              const header = encoder.encode(
                `--${boundary}\r\n${contentDisposition}\r\n${contentType}\r\n\r\n`
              );
              const footer = encoder.encode(`\r\n--${boundary}--\r\n`);
              
              // Combine header + file data + footer
              const body = new Uint8Array(header.length + uint8Array.length + footer.length);
              body.set(header, 0);
              body.set(uint8Array, header.length);
              body.set(footer, header.length + uint8Array.length);

              console.log(`Uploading attachment ${attachment.file_name} to Jira issue ${jiraKey}...`);

              const attachResponse = await fetch(
                `https://${jiraDomain}/rest/api/3/issue/${jiraKey}/attachments`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Basic ${auth}`,
                    'X-Atlassian-Token': 'no-check',
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                  },
                  body: body,
                }
              );

              if (attachResponse.ok) {
                console.log(`Successfully uploaded attachment ${attachment.file_name} to ${jiraKey}`);
                attachmentsUploaded++;
              } else {
                const attachError = await attachResponse.text();
                console.error(`Failed to upload attachment ${attachment.file_name}:`, attachResponse.status, attachError);
              }
            } catch (attachErr) {
              console.error(`Error processing attachment ${attachment.file_name}:`, attachErr);
            }
          }

          results.push({ 
            issueId: issue.id, 
            jiraKey, 
            attachmentsUploaded 
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error submitting ${issue.issue_number}:`, error);
        results.push({ issueId: issue.id, error: errorMessage });
      }
    }

    const successful = results.filter((r) => r.jiraKey && !r.skipped).length;
    const skipped = results.filter((r) => r.skipped).length;
    const failed = results.filter((r) => r.error).length;
    const totalAttachments = results.reduce((sum, r) => sum + (r.attachmentsUploaded || 0), 0);

    return new Response(
      JSON.stringify({
        success: failed === 0,
        successful,
        skipped,
        failed,
        totalAttachments,
        message: `Submitted ${successful} new issues to Jira with ${totalAttachments} attachments. ${skipped} already synced. ${failed} failed.`,
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
