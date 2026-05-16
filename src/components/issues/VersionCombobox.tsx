import { useState } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useSoftwareVersions } from '@/hooks/useSoftwareVersions';
import { VersionType } from '@/types/database';

interface Props {
  versionType: VersionType;
  value: string;
  onChange: (versionId: string) => void;
  placeholder?: string;
}

export const VersionCombobox = ({ versionType, value, onChange, placeholder }: Props) => {
  const { versions, addVersion, isAdding } = useSoftwareVersions(versionType);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected = versions.find((v) => v.id === value);
  const trimmed = search.trim();
  const exists = !!versions.find((v) => v.version.toLowerCase() === trimmed.toLowerCase());
  const isValidFormat = /^\d+\.\d+\.\d+$/.test(trimmed);

  const handleAdd = async () => {
    if (!trimmed || !isValidFormat) return;
    const v = await addVersion({ version: trimmed, version_type: versionType });
    onChange(v.id);
    setSearch('');
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          {selected ? selected.version : <span className="text-muted-foreground">{placeholder ?? 'Select or type version'}</span>}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter>
          <CommandInput placeholder="Type a version e.g. 1.2.3" value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>
              {trimmed ? (
                isValidFormat ? (
                  <Button type="button" size="sm" variant="ghost" disabled={isAdding} onClick={handleAdd} className="w-full">
                    <Plus className="mr-2 h-4 w-4" /> Add "{trimmed}"
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">Use format xx.xx.xx (e.g. 1.2.3)</span>
                )
              ) : (
                'No versions yet.'
              )}
            </CommandEmpty>
            <CommandGroup>
              {versions.map((v) => (
                <CommandItem
                  key={v.id}
                  value={v.version}
                  onSelect={() => {
                    onChange(v.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === v.id ? 'opacity-100' : 'opacity-0')} />
                  {v.version}
                </CommandItem>
              ))}
              {trimmed && !exists && isValidFormat && (
                <CommandItem onSelect={handleAdd} disabled={isAdding}>
                  <Plus className="mr-2 h-4 w-4" /> Add "{trimmed}"
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};