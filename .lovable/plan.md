## Plan

1. **Confirm the real Jira failure path**
   - Keep the Team ID logic unchanged for SAIR, because the current backend response is now a Jira `401` from the Jira create-issue API, not a local Team ID validation error.
   - Add a small backend credential/permission probe inside `submit-to-jira` before creating issues:
     - Call Jira `/myself` to verify the email/API token pair is valid.
     - Call Jira create metadata or project endpoint for the selected project to verify the account can access the target project.

2. **Return clearer errors to the Reports page**
   - If `/myself` fails, return: “Jira credentials are invalid or expired.”
   - If project access/create permission fails, return: “The Jira account is authenticated but does not have permission to create issues in SAIR/NEURA.”
   - If the issue create call still fails, pass through the Jira message, but label it as permission/configuration instead of Team ID.

3. **Add safe debug logging**
   - Log only safe credential metadata, such as configured email presence and token length/suffix, never the full API token.
   - Log selected project key, issue type, and Jira status code to make future debugging faster.

4. **Deploy and verify**
   - Deploy the updated `submit-to-jira` function.
   - Re-test from the Reports page and confirm the UI shows the exact Jira auth/permission cause.

## Likely external fix needed

The current Jira response says the configured Jira account is **not allowed to create issues in this project**. After the app-side diagnostics are added, the Jira admin will likely need to grant the configured `JIRA_EMAIL` account **Create issues** permission for the selected project (`SAIR`) and issue type (`Bug`), or replace the stored Jira API token/email with credentials for an account that already has that permission.