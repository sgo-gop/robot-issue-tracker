import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SoftwareVersion } from '@/types/database';
import { useToast } from '@/hooks/use-toast';

export const useSoftwareVersions = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const versionsQuery = useQuery({
    queryKey: ['software_versions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('software_versions')
        .select('*')
        .order('version', { ascending: false });

      if (error) throw error;
      return data as SoftwareVersion[];
    },
  });

  const addVersionMutation = useMutation({
    mutationFn: async ({ version, description }: { version: string; description?: string }) => {
      const { error } = await supabase
        .from('software_versions')
        .insert({ version, description });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['software_versions'] });
      toast({ title: 'Software version added!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error adding version', description: error.message, variant: 'destructive' });
    },
  });

  return {
    versions: versionsQuery.data ?? [],
    isLoading: versionsQuery.isLoading,
    addVersion: addVersionMutation.mutateAsync,
    isAdding: addVersionMutation.isPending,
  };
};
