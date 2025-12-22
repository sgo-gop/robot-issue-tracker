import { useState } from 'react';
import { useSoftwareVersions } from '@/hooks/useSoftwareVersions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Package, Loader2 } from 'lucide-react';

export const ManageSoftwareVersions = () => {
  const { versions, isLoading, addVersion, isAdding } = useSoftwareVersions();
  const [open, setOpen] = useState(false);
  const [newVersion, setNewVersion] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const handleAddVersion = async () => {
    if (!newVersion.trim()) return;
    await addVersion({ version: newVersion.trim(), description: newDescription.trim() || undefined });
    setNewVersion('');
    setNewDescription('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Package className="mr-2 h-4 w-4" />
          Manage Versions
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Software Versions</DialogTitle>
          <DialogDescription>
            Add and manage software versions for tracking
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="version-name">Version</Label>
            <Input
              id="version-name"
              placeholder="e.g., v1.2.3 or 2024.01"
              value={newVersion}
              onChange={(e) => setNewVersion(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="version-desc">Description (optional)</Label>
            <Textarea
              id="version-desc"
              placeholder="Brief description of this version"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={2}
            />
          </div>
          <Button onClick={handleAddVersion} disabled={isAdding || !newVersion.trim()} className="w-full">
            {isAdding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Add Version
          </Button>

          <div className="space-y-2">
            <Label>Existing Versions</Label>
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : versions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No versions added yet</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {versions.map((v) => (
                  <Badge key={v.id} variant="secondary" className="text-sm">
                    {v.version}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
