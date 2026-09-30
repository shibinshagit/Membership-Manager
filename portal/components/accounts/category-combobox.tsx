'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Pencil, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AppIcon } from '@/components/icons/app-icon';
import { cn } from '@/lib/utils';

function normalizeCategory(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function categoryKey(value: string): string {
  return normalizeCategory(value).toLowerCase();
}

export function mergeCategoryOptions(
  presets: string[],
  ...extraLists: Array<Array<string | null | undefined>>
): string[] {
  const map = new Map<string, string>();
  for (const list of [presets, ...extraLists.map((list) => list.filter(Boolean) as string[])]) {
    for (const raw of list) {
      const label = normalizeCategory(raw);
      if (!label) continue;
      const key = categoryKey(label);
      if (!map.has(key)) map.set(key, label);
    }
  }
  return [...map.values()].sort((a, b) => a.localeCompare(b));
}

export function CategoryCombobox({
  value,
  options,
  onChange,
  onRename,
  placeholder = 'Select category',
  searchPlaceholder = 'Search category...',
  className,
}: {
  value: string;
  options: string[];
  onChange: (next: string) => void;
  onRename?: (from: string, to: string) => void | Promise<void>;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const sortedOptions = useMemo(
    () => mergeCategoryOptions(options, value ? [value] : []),
    [options, value]
  );

  const trimmedQuery = normalizeCategory(query);
  const exactMatch = sortedOptions.some(
    (option) => categoryKey(option) === categoryKey(trimmedQuery)
  );
  const canAdd = trimmedQuery.length > 0 && !exactMatch;

  const selectCategory = (next: string) => {
    const label = normalizeCategory(next);
    if (!label) return;
    onChange(label);
    setOpen(false);
    setQuery('');
    setEditing(null);
    setRenameError(null);
  };

  const startEdit = (option: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditing(option);
    setEditValue(option);
    setRenameError(null);
  };

  const cancelEdit = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setEditing(null);
    setEditValue('');
    setRenameError(null);
  };

  const saveEdit = async (from: string, e?: React.MouseEvent | React.FormEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const to = normalizeCategory(editValue);
    if (!to) {
      setRenameError('Category name is required.');
      return;
    }
    if (categoryKey(to) === categoryKey(from)) {
      cancelEdit();
      return;
    }
    const duplicate = sortedOptions.some(
      (option) =>
        categoryKey(option) === categoryKey(to) && categoryKey(option) !== categoryKey(from)
    );
    if (duplicate) {
      setRenameError('That category already exists.');
      return;
    }

    setRenaming(true);
    setRenameError(null);
    try {
      await onRename?.(from, to);
      if (categoryKey(value) === categoryKey(from)) {
        onChange(to);
      }
      setEditing(null);
      setEditValue('');
    } catch (error) {
      setRenameError(error instanceof Error ? error.message : 'Failed to rename category.');
    } finally {
      setRenaming(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery('');
          setEditing(null);
          setRenameError(null);
        }
      }}
      modal
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between font-normal', className)}
        >
          <span className="truncate">{value || placeholder}</span>
          <AppIcon icon={ChevronsUpDown} className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {canAdd ? 'Press add to create this category.' : 'No category found.'}
            </CommandEmpty>
            {canAdd ? (
              <CommandGroup>
                <CommandItem
                  value={`__add__${trimmedQuery}`}
                  onSelect={() => selectCategory(trimmedQuery)}
                >
                  <AppIcon icon={Plus} className="h-4 w-4" />
                  Add “{trimmedQuery}”
                </CommandItem>
              </CommandGroup>
            ) : null}
            <CommandGroup>
              {sortedOptions
                .filter((option) =>
                  trimmedQuery
                    ? categoryKey(option).includes(categoryKey(trimmedQuery))
                    : true
                )
                .map((option) =>
                  editing && categoryKey(editing) === categoryKey(option) ? (
                    <div
                      key={`edit-${categoryKey(option)}`}
                      className="flex flex-col gap-1 px-2 py-1.5"
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <form
                        className="flex items-center gap-1"
                        onSubmit={(e) => saveEdit(option, e)}
                      >
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="h-8"
                          autoFocus
                          disabled={renaming}
                        />
                        <Button
                          type="submit"
                          size="icon-sm"
                          variant="ghost"
                          disabled={renaming}
                          title="Save"
                        >
                          <Check className="h-4 w-4 text-success" />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          disabled={renaming}
                          onClick={cancelEdit}
                          title="Cancel"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </form>
                      {renameError ? (
                        <p className="px-1 text-xs text-destructive">{renameError}</p>
                      ) : null}
                    </div>
                  ) : (
                    <CommandItem
                      key={categoryKey(option)}
                      value={option}
                      onSelect={() => selectCategory(option)}
                      className="group"
                    >
                      <Check
                        className={cn(
                          'h-4 w-4',
                          categoryKey(value) === categoryKey(option)
                            ? 'opacity-100'
                            : 'opacity-0'
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate">{option}</span>
                      {onRename ? (
                        <button
                          type="button"
                          className="rounded p-1 text-muted-foreground opacity-70 hover:bg-muted hover:text-foreground group-data-[selected=true]:opacity-100"
                          title="Edit category"
                          onClick={(e) => startEdit(option, e)}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </CommandItem>
                  )
                )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
