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

const ADMIN_PASSWORD = 'Neura2026';

export const ClearAllIssues = () => {
  const [password, setPassword] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleClearAll = async () => {
    if (password !== ADMIN_PASSWORD) {
      toast({
        title: 'Invalid password',
        description: 'The password you entered is incorrect.',
        variant: 'destructive',
      });
      return;
    }

    setIsDeleting(true);

    try {
      // First delete all attachments from storage
      const { data: attachments } = await supabase
        .from('issue_attachments')
        .select('file_path');

      if (attachments && attachments.length > 0) {
        const filePaths = attachments.map((a) => a.file_path);
        await supabase.storage.from('issue-attachments').remove(filePaths);
      }

      // Delete all attachments records
      await supabase.from('issue_attachments').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // Delete all issues
      const { error } = await supabase.from('issues').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;

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
        description: error.message,
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
