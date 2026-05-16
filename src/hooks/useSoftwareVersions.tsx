import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SoftwareVersion, VersionType } from '@/types/database';
import { useToast } from '@/hooks/use-toast';

export const useSoftwareVersions = (versionType?: VersionType) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const versionsQuery = useQuery({
    queryKey: ['software_versions', versionType ?? 'all'],
    queryFn: async () => {
      let q = supabase.from('software_versions').select('*').order('version', { ascending: false });
      if (versionType) q = q.eq('version_type', versionType);
      const { data, error } = await q;

      if (error) throw error;
      return data as SoftwareVersion[];
    },
  });

  const addVersionMutation = useMutation({
    mutationFn: async ({ version, description, version_type }: { version: string; description?: string; version_type?: VersionType }) => {
      const type = version_type ?? versionType ?? 'software';
      // Check if exists
      const { data: existing } = await supabase
        .from('software_versions')
        .select('*')
        .eq('version_type', type)
        .eq('version', version)
        .maybeSingle();
      if (existing) return existing as SoftwareVersion;

      const { data, error } = await supabase
        .from('software_versions')
        .insert({ version, description, version_type } as any)
        .select()
        .single();
      if (error) throw error;
      return data as SoftwareVersion;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['software_versions'] });
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
