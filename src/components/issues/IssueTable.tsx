import { useState } from 'react';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PriorityBadge, StatusBadge, CategoryBadge } from '@/components/badges/IssueBadges';
import { Issue, IssuePriority, IssueStatus, IssueCategory } from '@/types/database';
import { Search, Eye, CheckCircle, Loader2, Pencil } from 'lucide-react';
import { useIssues, useIssueAttachments } from '@/hooks/useIssues';
import { supabase } from '@/integrations/supabase/client';
import { EditIssueDialog } from './EditIssueDialog';

interface IssueTableProps {
  issues: Issue[];
  showActions?: boolean;
  onCloseIssue?: (issueId: string) => Promise<void>;
  isClosing?: boolean;
}

const IssueDetails = ({ issue }: { issue: Issue }) => {
  const { data: attachments } = useIssueAttachments(issue.id);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Issue Number</p>
          <p className="font-mono">{issue.issue_number}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Status</p>
          <StatusBadge status={issue.status} />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Priority</p>
          <PriorityBadge priority={issue.priority} />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Category</p>
          <CategoryBadge category={issue.category} />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Robot Type</p>
          <p>{issue.robot_type || 'Not assigned'}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Created</p>
          <p>{format(new Date(issue.created_at), 'PPp')}</p>
        </div>
        {issue.closed_at && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Closed</p>
            <p>{format(new Date(issue.closed_at), 'PPp')}</p>
          </div>
        )}
      </div>

      {issue.steps_to_reproduce && (
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">Steps to Reproduce</p>
          <p className="whitespace-pre-wrap rounded-md bg-muted p-3">{issue.steps_to_reproduce}</p>
        </div>
      )}

      {issue.expected_behavior && (
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">Expected Behavior</p>
          <p className="whitespace-pre-wrap rounded-md bg-muted p-3">{issue.expected_behavior}</p>
        </div>
      )}

      {issue.actual_behavior && (
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">Actual Behavior</p>
          <p className="whitespace-pre-wrap rounded-md bg-muted p-3">{issue.actual_behavior}</p>
        </div>
      )}

      {attachments && attachments.length > 0 && (
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Attachments</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {attachments.map((attachment) => {
              const { data } = supabase.storage
                .from('issue-attachments')
                .getPublicUrl(attachment.file_path);
              return (
                <a
                  key={attachment.id}
                  href={data.publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <img
                    src={data.publicUrl}
                    alt={attachment.file_name}
                    className="rounded-md border object-cover w-full h-24"
                  />
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export const IssueTable = ({ issues, showActions = false, onCloseIssue, isClosing }: IssueTableProps) => {
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<IssuePriority | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<IssueStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<IssueCategory | 'all'>('all');
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);

  const filteredIssues = issues.filter((issue) => {
    const matchesSearch =
      issue.title.toLowerCase().includes(search.toLowerCase()) ||
      issue.issue_number.toLowerCase().includes(search.toLowerCase()) ||
      (issue.steps_to_reproduce || '').toLowerCase().includes(search.toLowerCase());
    const matchesPriority = priorityFilter === 'all' || issue.priority === priorityFilter;
    const matchesStatus = statusFilter === 'all' || issue.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || issue.category === categoryFilter;
    return matchesSearch && matchesPriority && matchesStatus && matchesCategory;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search issues..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as IssueStatus | 'all')}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as IssuePriority | 'all')}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as IssueCategory | 'all')}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="hardware">Hardware</SelectItem>
              <SelectItem value="software">Software</SelectItem>
              <SelectItem value="mechanical">Mechanical</SelectItem>
              <SelectItem value="electrical">Electrical</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="w-[100px]">Priority</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[110px]">Category</TableHead>
              <TableHead className="w-[120px]">Robot</TableHead>
              <TableHead className="w-[150px]">Created</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredIssues.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No issues found
                </TableCell>
              </TableRow>
            ) : (
              filteredIssues.map((issue) => (
                <TableRow key={issue.id}>
                  <TableCell className="font-mono text-sm">{issue.issue_number}</TableCell>
                  <TableCell className="font-medium max-w-[250px] truncate">{issue.title}</TableCell>
                  <TableCell><PriorityBadge priority={issue.priority} /></TableCell>
                  <TableCell><StatusBadge status={issue.status} /></TableCell>
                  <TableCell><CategoryBadge category={issue.category} /></TableCell>
                  <TableCell className="text-sm">{issue.robot_type || '-'}</TableCell>
                  <TableCell className="text-sm">{format(new Date(issue.created_at), 'MMM d, yyyy')}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setSelectedIssue(issue)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingIssue(issue)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {showActions && issue.status === 'open' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onCloseIssue?.(issue.id)}
                          disabled={isClosing}
                        >
                          {isClosing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          )}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selectedIssue} onOpenChange={() => setSelectedIssue(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedIssue?.title}</DialogTitle>
          </DialogHeader>
          {selectedIssue && <IssueDetails issue={selectedIssue} />}
        </DialogContent>
      </Dialog>

      <EditIssueDialog issue={editingIssue} onClose={() => setEditingIssue(null)} />
    </div>
  );
};
