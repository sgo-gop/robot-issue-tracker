-- Add column to track Jira sync status
ALTER TABLE public.issues ADD COLUMN jira_issue_key TEXT DEFAULT NULL;

-- Add index for faster lookups
CREATE INDEX idx_issues_jira_issue_key ON public.issues(jira_issue_key);