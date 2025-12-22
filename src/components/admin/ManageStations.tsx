import { useState } from 'react';
import { useStations } from '@/hooks/useStations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Monitor, Loader2 } from 'lucide-react';

export const ManageStations = () => {
  const { stations, isLoading, addStation, isAdding } = useStations();
  const [open, setOpen] = useState(false);
  const [newStationName, setNewStationName] = useState('');

  const handleAddStation = async () => {
    if (!newStationName.trim()) return;
    await addStation(newStationName.trim());
    setNewStationName('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Monitor className="mr-2 h-4 w-4" />
          Manage Stations
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Robot Stations</DialogTitle>
          <DialogDescription>
            Add and manage robot testing stations
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="station-name" className="sr-only">
                Station Name
              </Label>
              <Input
                id="station-name"
                placeholder="Enter station name"
                value={newStationName}
                onChange={(e) => setNewStationName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddStation()}
              />
            </div>
            <Button onClick={handleAddStation} disabled={isAdding || !newStationName.trim()}>
              {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Existing Stations</Label>
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : stations.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No stations added yet</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {stations.map((station) => (
                  <Badge key={station.id} variant="secondary" className="text-sm">
                    {station.name}
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
