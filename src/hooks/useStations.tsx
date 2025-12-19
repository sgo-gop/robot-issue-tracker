import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Station } from '@/types/database';
import { useToast } from '@/hooks/use-toast';

export const useStations = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const stationsQuery = useQuery({
    queryKey: ['stations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stations')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Station[];
    },
  });

  const addStationMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase
        .from('stations')
        .insert({ name });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stations'] });
      toast({ title: 'Station added!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error adding station', description: error.message, variant: 'destructive' });
    },
  });

  return {
    stations: stationsQuery.data ?? [],
    isLoading: stationsQuery.isLoading,
    addStation: addStationMutation.mutateAsync,
    isAdding: addStationMutation.isPending,
  };
};