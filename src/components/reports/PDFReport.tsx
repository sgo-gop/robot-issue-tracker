import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Issue, IssueStatus, IssueAttachment } from '@/types/database';
import { ROBOT_TYPES } from '@/types/database';
import type { IssuePriority, IssueCategory } from '@/types/database';
import { useSoftwareVersions } from '@/hooks/useSoftwareVersions';
import { useAuth } from '@/hooks/useAuth';
import { useSession } from '@/hooks/useSession';
import { FileDown, CalendarIcon, Loader2, Send, Copy, Check, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Checkbox } from '@/components/ui/checkbox';

interface PDFReportProps {
  issues: Issue[];
}

export const PDFReport = ({ issues }: PDFReportProps) => {
  const { versions } = useSoftwareVersions();
  const { user: authUser } = useAuth();
  const { user: sessionUser } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmittingToJira, setIsSubmittingToJira] = useState(false);
  const [jiraProjectKey, setJiraProjectKey] = useState<'SAIR' | 'NEURA'>('SAIR');
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [statusFilter, setStatusFilter] = useState<IssueStatus | 'all'>('all');
  const [robotFilter, setRobotFilter] = useState<string>('all');
  const [softwareVersionFilter, setSoftwareVersionFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [selectedJiraIds, setSelectedJiraIds] = useState<Set<string>>(new Set());
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    priority: 'medium' as IssuePriority,
    category: 'other' as IssueCategory,
    steps_to_reproduce: '',
    expected_behavior: '',
    actual_behavior: '',
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const openEditDialog = (issue: Issue) => {
    setEditingIssue(issue);
    setEditForm({
      title: issue.title || '',
      description: issue.description || '',
      priority: issue.priority,
      category: issue.category,
      steps_to_reproduce: issue.steps_to_reproduce || '',
      expected_behavior: issue.expected_behavior || '',
      actual_behavior: issue.actual_behavior || '',
    });
  };

  const saveEdit = async () => {
    if (!editingIssue) return;
    setIsSavingEdit(true);
    try {
      const { error } = await supabase
        .from('issues')
        .update({
          title: editForm.title.trim(),
          description: editForm.description.trim(),
          priority: editForm.priority,
          category: editForm.category,
          steps_to_reproduce: editForm.steps_to_reproduce.trim() || null,
          expected_behavior: editForm.expected_behavior.trim() || null,
          actual_behavior: editForm.actual_behavior.trim() || null,
        })
        .eq('id', editingIssue.id);
      if (error) throw error;
      toast({ title: 'Issue updated' });
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      setEditingIssue(null);
    } catch (e) {
      toast({ title: 'Failed to update', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const filteredIssues = issues.filter((issue) => {
    const matchesStatus = statusFilter === 'all' || issue.status === statusFilter;
    const matchesRobot = robotFilter === 'all' || issue.robot_type === robotFilter;
    const matchesSoftwareVersion = softwareVersionFilter === 'all' || issue.software_version_id === softwareVersionFilter;
    const issueDate = new Date(issue.created_at);
    const matchesStart = !startDate || issueDate >= startDate;
    const matchesEnd = !endDate || issueDate <= endDate;
    return matchesStatus && matchesRobot && matchesSoftwareVersion && matchesStart && matchesEnd;
  });

  // Get the selected software version name
  const selectedSoftwareVersion = softwareVersionFilter !== 'all' 
    ? versions.find(v => v.id === softwareVersionFilter)?.version 
    : null;

  // Get the current user's name from auth or session
  const reporterName = authUser?.user_metadata?.full_name || authUser?.email || sessionUser?.name || 'Unknown User';

  // Issues that haven't been synced to Jira yet
  const unsyncedIssues = filteredIssues.filter((issue) => !issue.jira_issue_key);
  const alreadySyncedCount = filteredIssues.length - unsyncedIssues.length;

  // Default selection: all unsynced issues whenever the set changes
  const unsyncedIdsKey = unsyncedIssues.map((i) => i.id).join(',');
  useEffect(() => {
    setSelectedJiraIds(new Set(unsyncedIssues.map((i) => i.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unsyncedIdsKey]);

  const toggleIssueSelection = (id: string, checked: boolean) => {
    setSelectedJiraIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelectedJiraIds(checked ? new Set(unsyncedIssues.map((i) => i.id)) : new Set());
  };

  const selectedUnsyncedIssues = unsyncedIssues.filter((i) => selectedJiraIds.has(i.id));

  const generatePDF = async () => {
    setIsGenerating(true);

    // Fetch attachments for all filtered issues
    const issueIds = filteredIssues.map(issue => issue.id);
    const { data: attachments } = await supabase
      .from('issue_attachments')
      .select('*')
      .in('issue_id', issueIds);

    // Group attachments by issue_id
    const attachmentsByIssue: Record<string, IssueAttachment[]> = {};
    (attachments || []).forEach((att) => {
      if (!attachmentsByIssue[att.issue_id]) {
        attachmentsByIssue[att.issue_id] = [];
      }
      attachmentsByIssue[att.issue_id].push(att as IssueAttachment);
    });

    // Lookup map for version ids -> version string
    const versionMap: Record<string, string> = {};
    versions.forEach((v) => { versionMap[v.id] = v.version; });
    const versionOf = (id?: string | null) => (id ? versionMap[id] || '-' : '-');

    // Get public URLs for all attachments
    const getPublicUrl = (filePath: string) => {
      const { data } = supabase.storage.from('issue-attachments').getPublicUrl(filePath);
      return data.publicUrl;
    };

    // Create HTML content for print
    const escapeHtml = (text: string | null | undefined) => {
      if (!text) return '-';
      return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '<br>');
    };

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Issue Report - ${format(new Date(), 'yyyy-MM-dd')}</title>
        <style>
          * { font-family: 'Arial', sans-serif; margin: 0; padding: 0; box-sizing: border-box; }
          body { padding: 40px; color: #1a1a1a; font-size: 12px; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e5e5e5; padding-bottom: 20px; }
          .header h1 { font-size: 24px; margin-bottom: 8px; }
          .header p { color: #666; font-size: 14px; }
          .summary { display: flex; gap: 20px; margin-bottom: 30px; }
          .summary-card { flex: 1; background: #f5f5f5; padding: 15px; border-radius: 8px; text-align: center; }
          .summary-card h3 { font-size: 24px; color: #1a1a1a; }
          .summary-card p { font-size: 12px; color: #666; }
          .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }
          .priority-critical { background: #fef2f2; color: #dc2626; }
          .priority-high { background: #fff7ed; color: #ea580c; }
          .priority-medium { background: #fefce8; color: #ca8a04; }
          .priority-low { background: #f0fdf4; color: #16a34a; }
          .status-open { background: #dbeafe; color: #2563eb; }
          .status-closed { background: #f3f4f6; color: #6b7280; }
          .category-badge { background: #f3e8ff; color: #7c3aed; }
          .issue-card { border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px; margin-bottom: 20px; page-break-inside: avoid; }
          .issue-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #e5e5e5; }
          .issue-title { font-size: 16px; font-weight: 600; margin-bottom: 5px; }
          .issue-number { font-family: monospace; color: #666; font-size: 12px; }
          .issue-meta { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
          .issue-section { margin-bottom: 12px; }
          .issue-section-title { font-weight: 600; color: #374151; margin-bottom: 4px; font-size: 11px; text-transform: uppercase; }
          .issue-section-content { background: #f9fafb; padding: 10px; border-radius: 4px; line-height: 1.5; }
          .issue-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 15px; }
          .issue-field { }
          .issue-field-label { font-size: 10px; color: #6b7280; text-transform: uppercase; margin-bottom: 2px; }
          .issue-field-value { font-size: 12px; }
          .attachments-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
          .attachment-img { width: 100%; height: 150px; object-fit: cover; border-radius: 4px; border: 1px solid #e5e5e5; }
          .attachment-file { background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 11px; word-break: break-all; }
          .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; padding-top: 20px; border-top: 1px solid #e5e5e5; }
          @media print { 
            body { padding: 20px; } 
            .issue-card { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Robot Testing Issue Report</h1>
          <p>Generated on ${format(new Date(), 'MMMM d, yyyy \'at\' h:mm a')}</p>
          <p><strong>Created by:</strong> ${reporterName}</p>
          ${selectedSoftwareVersion ? `<p><strong>Software Version:</strong> ${selectedSoftwareVersion}</p>` : ''}
          ${startDate || endDate ? `<p>Date range: ${startDate ? format(startDate, 'MMM d, yyyy') : 'Start'} - ${endDate ? format(endDate, 'MMM d, yyyy') : 'Present'}</p>` : ''}
        </div>
        
        <div class="summary">
          <div class="summary-card">
            <h3>${filteredIssues.length}</h3>
            <p>Total Issues</p>
          </div>
          <div class="summary-card">
            <h3>${filteredIssues.filter(i => i.status === 'open').length}</h3>
            <p>Open Issues</p>
          </div>
          <div class="summary-card">
            <h3>${filteredIssues.filter(i => i.status === 'closed').length}</h3>
            <p>Closed Issues</p>
          </div>
          <div class="summary-card">
            <h3>${filteredIssues.filter(i => i.priority === 'critical' || i.priority === 'high').length}</h3>
            <p>High Priority</p>
          </div>
        </div>

        <h2 style="margin-bottom: 15px; font-size: 18px;">Issue Details</h2>

        ${filteredIssues.map(issue => {
          const issueAttachments = attachmentsByIssue[issue.id] || [];
          const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
          
          return `
          <div class="issue-card">
            <div class="issue-header">
              <div>
                <div class="issue-title">${escapeHtml(issue.title)}</div>
                <div class="issue-number">${issue.issue_number}</div>
                <div class="issue-meta">
                  <span class="badge priority-${issue.priority}">${issue.priority.toUpperCase()}</span>
                  <span class="badge status-${issue.status}">${issue.status.toUpperCase()}</span>
                  <span class="badge category-badge">${issue.category.toUpperCase()}</span>
                </div>
              </div>
            </div>
            
            <div class="issue-grid">
              <div class="issue-field">
                <div class="issue-field-label">Robot</div>
                <div class="issue-field-value">${issue.robot_type || 'Not assigned'}</div>
              </div>
              <div class="issue-field">
                <div class="issue-field-label">Other Equipment</div>
                <div class="issue-field-value">${escapeHtml(issue.other_equipment)}</div>
              </div>
              <div class="issue-field">
                <div class="issue-field-label">Created</div>
                <div class="issue-field-value">${format(new Date(issue.created_at), 'MMM d, yyyy h:mm a')}</div>
              </div>
              <div class="issue-field">
                <div class="issue-field-label">${issue.status === 'closed' ? 'Closed' : 'Last Updated'}</div>
                <div class="issue-field-value">${issue.closed_at ? format(new Date(issue.closed_at), 'MMM d, yyyy h:mm a') : format(new Date(issue.updated_at), 'MMM d, yyyy h:mm a')}</div>
              </div>
            </div>

            <div class="issue-grid">
              <div class="issue-field">
                <div class="issue-field-label">Software Version</div>
                <div class="issue-field-value">${versionOf(issue.software_version_id)}</div>
              </div>
              <div class="issue-field">
                <div class="issue-field-label">GUI Version</div>
                <div class="issue-field-value">${versionOf(issue.gui_version_id)}</div>
              </div>
              <div class="issue-field">
                <div class="issue-field-label">AI Version</div>
                <div class="issue-field-value">${versionOf(issue.ai_version_id)}</div>
              </div>
              <div class="issue-field">
                <div class="issue-field-label">Drive Firmware</div>
                <div class="issue-field-value">${versionOf(issue.drive_firmware_version_id)}</div>
              </div>
              <div class="issue-field">
                <div class="issue-field-label">Safety-Logic</div>
                <div class="issue-field-value">${versionOf(issue.safety_logic_version_id)}</div>
              </div>
              <div class="issue-field">
                <div class="issue-field-label">Safety-Firmware</div>
                <div class="issue-field-value">${versionOf(issue.safety_firmware_version_id)}</div>
              </div>
            </div>

            <div class="issue-section">
              <div class="issue-section-title">Description</div>
              <div class="issue-section-content">${escapeHtml(issue.description)}</div>
            </div>

            ${issue.steps_to_reproduce ? `
              <div class="issue-section">
                <div class="issue-section-title">Steps to Reproduce</div>
                <div class="issue-section-content">${escapeHtml(issue.steps_to_reproduce)}</div>
              </div>
            ` : ''}

            ${issue.expected_behavior ? `
              <div class="issue-section">
                <div class="issue-section-title">Expected Behavior</div>
                <div class="issue-section-content">${escapeHtml(issue.expected_behavior)}</div>
              </div>
            ` : ''}

            ${issue.actual_behavior ? `
              <div class="issue-section">
                <div class="issue-section-title">Actual Behavior</div>
                <div class="issue-section-content">${escapeHtml(issue.actual_behavior)}</div>
              </div>
            ` : ''}

            ${issueAttachments.length > 0 ? `
              <div class="issue-section">
                <div class="issue-section-title">Attachments (${issueAttachments.length})</div>
                <div class="attachments-grid">
                  ${issueAttachments.map(att => {
                    const isImage = imageExtensions.some(ext => att.file_name.toLowerCase().endsWith(ext));
                    const url = getPublicUrl(att.file_path);
                    if (isImage) {
                      return `<img src="${url}" alt="${escapeHtml(att.file_name)}" class="attachment-img" />`;
                    } else {
                      return `<div class="attachment-file">${escapeHtml(att.file_name)}</div>`;
                    }
                  }).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        `}).join('')}

        <div class="footer">
          <p>Robot Testing Issue Tracker • Confidential • Page generated automatically</p>
        </div>
      </body>
      </html>
    `;

    // Open print window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }

    setIsGenerating(false);
  };

  const submitToJira = async () => {
    if (unsyncedIssues.length === 0) {
      toast({
        title: 'All issues already synced',
        description: 'All filtered issues have already been submitted to Jira.',
      });
      return;
    }
    if (selectedUnsyncedIssues.length === 0) {
      toast({
        title: 'No issues selected',
        description: 'Please select at least one issue to submit to Jira.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSubmittingToJira(true);
    try {
      const versionMap: Record<string, string> = {};
      versions.forEach((v) => { versionMap[v.id] = v.version; });
      const enrichedIssues = selectedUnsyncedIssues.map((i) => ({
        ...i,
        software_version: i.software_version_id ? versionMap[i.software_version_id] || null : null,
        gui_version: i.gui_version_id ? versionMap[i.gui_version_id] || null : null,
        ai_version: i.ai_version_id ? versionMap[i.ai_version_id] || null : null,
        drive_firmware_version: i.drive_firmware_version_id ? versionMap[i.drive_firmware_version_id] || null : null,
        safety_logic_version: i.safety_logic_version_id ? versionMap[i.safety_logic_version_id] || null : null,
        safety_firmware_version: i.safety_firmware_version_id ? versionMap[i.safety_firmware_version_id] || null : null,
      }));
      const { data, error } = await supabase.functions.invoke('submit-to-jira', {
        body: { issues: enrichedIssues, projectKey: jiraProjectKey, reporterName }
      });

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error('No response from Jira');
      }

      const firstFailure = Array.isArray(data.results)
        ? data.results.find((r: any) => r?.error)?.error
        : null;

      if (data.success === false) {
        const isTeamError = data.field === 'Team';
        const message = isTeamError
          ? data.error || 'Please provide a valid Jira Team ID and retry.'
          : firstFailure || data.error || data.message || 'Jira rejected the submission.';
        setErrorDialog({
          title: isTeamError ? 'Jira needs a Team ID' : 'Jira submission failed',
          message: String(message),
        });
        return;
      }

      if (data.failed > 0 && firstFailure) {
        setErrorDialog({
          title: 'Jira submission finished (with errors)',
          message: `${data.message}\n\nFirst error:\n${String(firstFailure)}`,
        });
      } else {
        toast({
          title: 'Submitted to Jira',
          description: data.message,
        });
      }

      // Refresh issues to update jira_issue_key values
      queryClient.invalidateQueries({ queryKey: ['issues'] });
    } catch (error) {
      console.error('Error submitting to Jira:', error);
      setErrorDialog({
        title: 'Error submitting to Jira',
        message: error instanceof Error ? (error.stack || error.message) : String(error),
      });
    } finally {
      setIsSubmittingToJira(false);
    }
  };

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Generate Report</CardTitle>
        <CardDescription>Export filtered issues as a PDF report</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as IssueStatus | 'all')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open Only</SelectItem>
                <SelectItem value="closed">Closed Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Robot Type</Label>
            <Select value={robotFilter} onValueChange={setRobotFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Robots</SelectItem>
                {ROBOT_TYPES.map((rt) => (
                  <SelectItem key={rt} value={rt}>
                    {rt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Software Version</Label>
            <Select value={softwareVersionFilter} onValueChange={setSoftwareVersionFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Versions</SelectItem>
                {versions.map((version) => (
                  <SelectItem key={version.id} value={version.id}>
                    {version.version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Start Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !startDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>End Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !endDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Jira Project</Label>
          <Select value={jiraProjectKey} onValueChange={(v) => setJiraProjectKey(v as 'SAIR' | 'NEURA')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SAIR">SAIR</SelectItem>
              <SelectItem value="NEURA">NEURA</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md bg-muted p-4 space-y-1">
          <p className="text-sm text-muted-foreground">
            {filteredIssues.length} issue{filteredIssues.length !== 1 ? 's' : ''} match your filters
          </p>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">{unsyncedIssues.length}</span> not yet synced to Jira
            {alreadySyncedCount > 0 && (
              <span className="text-green-600 ml-2">({alreadySyncedCount} already synced)</span>
            )}
          </p>
        </div>

        {unsyncedIssues.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Select issues to submit to Jira</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all-jira"
                  checked={selectedJiraIds.size === unsyncedIssues.length && unsyncedIssues.length > 0}
                  onCheckedChange={(c) => toggleSelectAll(Boolean(c))}
                />
                <label htmlFor="select-all-jira" className="text-xs text-muted-foreground cursor-pointer">
                  Select all ({selectedJiraIds.size}/{unsyncedIssues.length})
                </label>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto rounded-md border divide-y">
              {unsyncedIssues.map((issue) => (
                <label
                  key={issue.id}
                  htmlFor={`jira-issue-${issue.id}`}
                  className="flex items-start gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    id={`jira-issue-${issue.id}`}
                    checked={selectedJiraIds.has(issue.id)}
                    onCheckedChange={(c) => toggleIssueSelection(issue.id, Boolean(c))}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{issue.issue_number}</span>
                      <span className="text-xs uppercase px-1.5 py-0.5 rounded bg-muted">{issue.priority}</span>
                      <span className="text-xs uppercase px-1.5 py-0.5 rounded bg-muted">{issue.status}</span>
                    </div>
                    <div className="text-sm font-medium truncate">{issue.title}</div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEditDialog(issue); }}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={generatePDF} disabled={isGenerating || filteredIssues.length === 0} className="flex-1">
            {isGenerating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-4 w-4" />
            )}
            Generate PDF Report
          </Button>
          <Button 
            onClick={submitToJira} 
            disabled={isSubmittingToJira || selectedUnsyncedIssues.length === 0} 
            variant="secondary"
            className="flex-1"
          >
            {isSubmittingToJira ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Submit to Jira ({selectedUnsyncedIssues.length})
          </Button>
        </div>
      </CardContent>
    </Card>
    {errorDialog && (
      <Dialog open onOpenChange={(open) => { if (!open) { setErrorDialog(null); setCopied(false); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{errorDialog.title}</DialogTitle>
            <DialogDescription>You can copy the full error below to share with the team.</DialogDescription>
          </DialogHeader>
          <Textarea
            readOnly
            value={errorDialog.message}
            className="font-mono text-xs min-h-[200px] max-h-[400px]"
            onFocus={(e) => e.currentTarget.select()}
          />
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(errorDialog.message);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  toast({ title: 'Copy failed', description: 'Select and copy manually.', variant: 'destructive' });
                }
              }}
            >
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? 'Copied' : 'Copy error'}
            </Button>
            <Button onClick={() => { setErrorDialog(null); setCopied(false); }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}
    {editingIssue && (
      <Dialog open onOpenChange={(open) => { if (!open) setEditingIssue(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Issue {editingIssue.issue_number}</DialogTitle>
            <DialogDescription>Make changes before submitting to Jira.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={editForm.priority} onValueChange={(v) => setEditForm({ ...editForm, priority: v as IssuePriority })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={editForm.category} onValueChange={(v) => setEditForm({ ...editForm, category: v as IssueCategory })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hardware">Hardware</SelectItem>
                    <SelectItem value="software">Software</SelectItem>
                    <SelectItem value="mechanical">Mechanical</SelectItem>
                    <SelectItem value="electrical">Electrical</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea rows={4} maxLength={32000} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
              <p className={`text-xs text-right ${editForm.description.length >= 32000 ? 'text-destructive' : editForm.description.length > 28800 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                {editForm.description.length >= 32000 ? 'Limit reached — ' : ''}{editForm.description.length}/32000 characters
              </p>
            </div>
            <div className="space-y-2">
              <Label>Steps to Reproduce</Label>
              <Textarea rows={3} maxLength={32000} value={editForm.steps_to_reproduce} onChange={(e) => setEditForm({ ...editForm, steps_to_reproduce: e.target.value })} />
              <p className={`text-xs text-right ${editForm.steps_to_reproduce.length >= 32000 ? 'text-destructive' : editForm.steps_to_reproduce.length > 28800 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                {editForm.steps_to_reproduce.length >= 32000 ? 'Limit reached — ' : ''}{editForm.steps_to_reproduce.length}/32000 characters
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Expected Behavior</Label>
                <Textarea rows={3} maxLength={255} value={editForm.expected_behavior} onChange={(e) => setEditForm({ ...editForm, expected_behavior: e.target.value })} />
                <p className={`text-xs text-right font-medium ${editForm.expected_behavior.length >= 255 ? 'text-destructive' : editForm.expected_behavior.length > 230 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                  {editForm.expected_behavior.length >= 255 ? 'Limit reached — ' : ''}{editForm.expected_behavior.length}/255 characters
                </p>
              </div>
              <div className="space-y-2">
                <Label>Actual Behavior</Label>
                <Textarea rows={3} maxLength={255} value={editForm.actual_behavior} onChange={(e) => setEditForm({ ...editForm, actual_behavior: e.target.value })} />
                <p className={`text-xs text-right font-medium ${editForm.actual_behavior.length >= 255 ? 'text-destructive' : editForm.actual_behavior.length > 230 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                  {editForm.actual_behavior.length >= 255 ? 'Limit reached — ' : ''}{editForm.actual_behavior.length}/255 characters
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingIssue(null)} disabled={isSavingEdit}>Cancel</Button>
            <Button onClick={saveEdit} disabled={isSavingEdit || !editForm.title.trim() || !editForm.description.trim()}>
              {isSavingEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}
    </>
  );
};
