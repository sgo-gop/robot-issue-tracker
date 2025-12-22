import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { IssuePriority, IssueCategory } from '@/types/database';
import { useToast } from '@/hooks/use-toast';

interface CreateIssueData {
  title: string;
  description: string;
  priority: IssuePriority;
  category: IssueCategory;
  station_id: string | null;
  software_version_id?: string | null;
  steps_to_reproduce?: string;
  expected_behavior?: string;
  actual_behavior?: string;
  reporter_id: string | null;
}

export const useIssues = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const issuesQuery = useQuery({
    queryKey: ['issues'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('issues')
        .select(`*, stations (id, name), software_versions (id, version)`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createIssueMutation = useMutation({
    mutationFn: async (issueData: CreateIssueData) => {
      const { data, error } = await supabase.from('issues').insert(issueData as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      toast({ title: 'Issue created successfully!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error creating issue', description: error.message, variant: 'destructive' });
    },
  });

  const closeIssueMutation = useMutation({
    mutationFn: async (issueId: string) => {
      const { error } = await supabase.from('issues').update({ status: 'closed' as const, closed_at: new Date().toISOString() }).eq('id', issueId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      toast({ title: 'Issue closed successfully!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error closing issue', description: error.message, variant: 'destructive' });
    },
  });

  return { issues: issuesQuery.data ?? [], isLoading: issuesQuery.isLoading, createIssue: createIssueMutation.mutateAsync, closeIssue: closeIssueMutation.mutateAsync, isCreating: createIssueMutation.isPending, isClosing: closeIssueMutation.isPending };
};

export const useIssueAttachments = (issueId: string) => useQuery({ queryKey: ['attachments', issueId], queryFn: async () => { const { data, error } = await supabase.from('issue_attachments').select('*').eq('issue_id', issueId); if (error) throw error; return data; }, enabled: !!issueId });

export const useUploadAttachment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ issueId, file }: { issueId: string; file: File }) => {
      const filePath = `${issueId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('issue-attachments').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { error: dbError } = await supabase.from('issue_attachments').insert({ issue_id: issueId, file_path: filePath, file_name: file.name } as any);
      if (dbError) throw dbError;
    },
    onSuccess: (_, { issueId }) => { queryClient.invalidateQueries({ queryKey: ['attachments', issueId] }); toast({ title: 'Attachment uploaded!' }); },
    onError: (error: Error) => { toast({ title: 'Error uploading', description: error.message, variant: 'destructive' }); },
  });
};