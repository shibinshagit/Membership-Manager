'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { AppIcon } from '@/components/icons/app-icon';

export type MemberOption = {
  id: number;
  full_name: string;
  member_id: string;
};

export function MemberCombobox({
  members,
  value,
  onValueChange,
  placeholder = 'Select member',
  disabled = false,
  className,
}: {
  members: MemberOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = members.find((member) => String(member.id) === value);

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'h-9 w-full justify-between px-3 font-normal',
            !selected && 'text-muted-foreground',
            className
          )}
        >
          <span className="truncate">
            {selected
              ? `${selected.full_name} (${selected.member_id})`
              : placeholder}
          </span>
          <AppIcon icon={ChevronsUpDown} className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search by name or ID..." />
          <CommandList>
            <CommandEmpty>No member found.</CommandEmpty>
            <CommandGroup>
              {members.map((member) => {
                const id = String(member.id);
                return (
                  <CommandItem
                    key={member.id}
                    value={`${member.full_name} ${member.member_id}`}
                    onSelect={() => {
                      onValueChange(id);
                      setOpen(false);
                    }}
                  >
                    <AppIcon
                      icon={Check}
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className="min-w-0 truncate">
                      {member.full_name}
                      <span className="ml-1 text-muted-foreground">
                        ({member.member_id})
                      </span>
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
