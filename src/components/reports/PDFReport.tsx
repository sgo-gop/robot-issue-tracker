import { useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Issue, IssueStatus, IssueAttachment } from '@/types/database';
import { useStations } from '@/hooks/useStations';
import { FileDown, CalendarIcon, Loader2, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PDFReportProps {
  issues: Issue[];
}

export const PDFReport = ({ issues }: PDFReportProps) => {
  const { stations } = useStations();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmittingToJira, setIsSubmittingToJira] = useState(false);
  const [statusFilter, setStatusFilter] = useState<IssueStatus | 'all'>('all');
  const [stationFilter, setStationFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  const filteredIssues = issues.filter((issue) => {
    const matchesStatus = statusFilter === 'all' || issue.status === statusFilter;
    const matchesStation = stationFilter === 'all' || issue.station_id === stationFilter;
    const issueDate = new Date(issue.created_at);
    const matchesStart = !startDate || issueDate >= startDate;
    const matchesEnd = !endDate || issueDate <= endDate;
    return matchesStatus && matchesStation && matchesStart && matchesEnd;
  });

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
                <div class="issue-field-label">Station</div>
                <div class="issue-field-value">${issue.stations?.name || 'Not assigned'}</div>
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
    setIsSubmittingToJira(true);
    try {
      const { data, error } = await supabase.functions.invoke('submit-to-jira', {
        body: { issues: filteredIssues }
      });

      if (error) {
        throw error;
      }

      toast({
        title: 'Submitted to Jira',
        description: data.message,
      });
    } catch (error) {
      console.error('Error submitting to Jira:', error);
      toast({
        title: 'Error submitting to Jira',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingToJira(false);
    }
  };

  return (
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
            <Label>Station</Label>
            <Select value={stationFilter} onValueChange={setStationFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stations</SelectItem>
                {stations.map((station) => (
                  <SelectItem key={station.id} value={station.id}>
                    {station.name}
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

        <div className="rounded-md bg-muted p-4">
          <p className="text-sm text-muted-foreground">
            {filteredIssues.length} issue{filteredIssues.length !== 1 ? 's' : ''} match your filters
          </p>
        </div>

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
            disabled={isSubmittingToJira || filteredIssues.length === 0} 
            variant="secondary"
            className="flex-1"
          >
            {isSubmittingToJira ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Submit to Jira
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
