import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import type { Issue, IssuePriority, IssueCategory } from '@/types/database';

interface EditIssueDialogProps {
  issue: Issue | null;
  onClose: () => void;
  description?: string;
}

export const EditIssueDialog = ({ issue, onClose, description }: EditIssueDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium' as IssuePriority,
    category: 'other' as IssueCategory,
    steps_to_reproduce: '',
    expected_behavior: '',
    actual_behavior: '',
  });

  useEffect(() => {
    if (!issue) return;
    setForm({
      title: issue.title || '',
      description: issue.description || '',
      priority: issue.priority,
      category: issue.category,
      steps_to_reproduce: issue.steps_to_reproduce || '',
      expected_behavior: issue.expected_behavior || '',
      actual_behavior: issue.actual_behavior || '',
    });
  }, [issue]);

  if (!issue) return null;

  const save = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('issues')
        .update({
          title: form.title.trim(),
          description: form.description.trim(),
          priority: form.priority,
          category: form.category,
          steps_to_reproduce: form.steps_to_reproduce.trim() || null,
          expected_behavior: form.expected_behavior.trim() || null,
          actual_behavior: form.actual_behavior.trim() || null,
        })
        .eq('id', issue.id);
      if (error) throw error;
      toast({ title: 'Issue updated' });
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      onClose();
    } catch (e) {
      toast({ title: 'Failed to update', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Issue {issue.issue_number}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as IssuePriority })}>
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
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as IssueCategory })}>
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
            <Textarea rows={4} maxLength={32000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <p className={`text-xs text-right ${form.description.length >= 32000 ? 'text-destructive' : form.description.length > 28800 ? 'text-amber-500' : 'text-muted-foreground'}`}>
              {form.description.length >= 32000 ? 'Limit reached — ' : ''}{form.description.length}/32000 characters
            </p>
          </div>
          <div className="space-y-2">
            <Label>Steps to Reproduce</Label>
            <Textarea rows={3} maxLength={32000} value={form.steps_to_reproduce} onChange={(e) => setForm({ ...form, steps_to_reproduce: e.target.value })} />
            <p className={`text-xs text-right ${form.steps_to_reproduce.length >= 32000 ? 'text-destructive' : form.steps_to_reproduce.length > 28800 ? 'text-amber-500' : 'text-muted-foreground'}`}>
              {form.steps_to_reproduce.length >= 32000 ? 'Limit reached — ' : ''}{form.steps_to_reproduce.length}/32000 characters
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Expected Behavior</Label>
              <Textarea rows={3} maxLength={255} value={form.expected_behavior} onChange={(e) => setForm({ ...form, expected_behavior: e.target.value })} />
              <p className={`text-xs text-right font-medium ${form.expected_behavior.length >= 255 ? 'text-destructive' : form.expected_behavior.length > 230 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                {form.expected_behavior.length >= 255 ? 'Limit reached — ' : ''}{form.expected_behavior.length}/255 characters
              </p>
            </div>
            <div className="space-y-2">
              <Label>Actual Behavior</Label>
              <Textarea rows={3} maxLength={255} value={form.actual_behavior} onChange={(e) => setForm({ ...form, actual_behavior: e.target.value })} />
              <p className={`text-xs text-right font-medium ${form.actual_behavior.length >= 255 ? 'text-destructive' : form.actual_behavior.length > 230 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                {form.actual_behavior.length >= 255 ? 'Limit reached — ' : ''}{form.actual_behavior.length}/255 characters
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={save} disabled={isSaving || !form.title.trim() || !form.description.trim()}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};