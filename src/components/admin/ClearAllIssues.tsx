import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

export const ClearAllIssues = () => {
  const [password, setPassword] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleClearAll = async () => {
    if (!password) return;
    setIsDeleting(true);

    try {
      const { data, error } = await supabase.functions.invoke('clear-all-issues', {
        body: { password },
      });

      if (error || (data && (data as any).error)) {
        const msg = (data as any)?.error || error?.message || 'Failed to clear issues';
        toast({
          title: msg.toLowerCase().includes('password') ? 'Invalid password' : 'Error clearing issues',
          description: msg,
          variant: 'destructive',
        });
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['issues'] });
      toast({
        title: 'All issues cleared',
        description: 'All issues and attachments have been permanently deleted.',
      });
      setIsOpen(false);
      setPassword('');
    } catch (error: any) {
      toast({
        title: 'Error clearing issues',
        description: error?.message ?? 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className="gap-2">
          <Trash2 className="h-4 w-4" />
          Clear All Issues
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear All Issues</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete all issues
            and their attachments from the database.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 py-4">
          <Label htmlFor="admin-password">Enter admin password to confirm</Label>
          <Input
            id="admin-password"
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setPassword('')}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleClearAll();
            }}
            disabled={isDeleting || !password}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete All Issues
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
