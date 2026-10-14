'use client';

import * as React from 'react';
import { Command } from 'cmdk';
import { Check, ChevronsUpDown, Plus, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface ComboOption {
  value: string;
  label: string;
  /** Texto auxiliar à direita (ex.: modelo do caminhão) */
  hint?: string;
}

const triggerCls =
  'flex min-h-11 w-full items-center justify-between gap-2 rounded-xl bg-white px-3 text-left text-base shadow-sm ring-1 ring-slate-200 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 sm:min-h-10 sm:text-sm';

const itemCls =
  'flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2.5 text-sm text-slate-700 data-[selected=true]:bg-sky-50 data-[selected=true]:text-slate-900 sm:py-2';

function List({
  options,
  isSelected,
  onSelect,
  onCreate,
  createLabel,
  emptyText,
  searchPlaceholder,
  closePopover,
}: {
  options: ComboOption[];
  isSelected: (v: string) => boolean;
  onSelect: (v: string) => void;
  onCreate?: (search: string) => void;
  createLabel?: string;
  emptyText: string;
  searchPlaceholder: string;
  closePopover: () => void;
}) {
  const [search, setSearch] = React.useState('');
  return (
    <Command className="flex flex-col" shouldFilter>
      <Command.Input
        value={search}
        onValueChange={setSearch}
        placeholder={searchPlaceholder}
        className="h-11 w-full border-0 border-b border-slate-100 bg-transparent px-3 text-base outline-none placeholder:text-slate-400 sm:h-10 sm:text-sm"
      />
      <Command.List className="max-h-56 overflow-y-auto p-1">
        <Command.Empty className="px-3 py-4 text-center text-sm text-slate-500">{emptyText}</Command.Empty>
        {options.map((o) => (
          <Command.Item
            key={o.value}
            value={`${o.label} ${o.hint ?? ''} ${o.value}`}
            onSelect={() => onSelect(o.value)}
            className={itemCls}
          >
            <Check className={cn('h-4 w-4 shrink-0 text-sky-600', isSelected(o.value) ? 'opacity-100' : 'opacity-0')} />
            <span className="flex-1 truncate font-medium">{o.label}</span>
            {o.hint && <span className="truncate text-xs text-slate-400">{o.hint}</span>}
          </Command.Item>
        ))}
      </Command.List>
      {onCreate && (
        <button
          type="button"
          onClick={() => {
            closePopover();
            onCreate(search.trim());
          }}
          className="flex min-h-11 items-center gap-2 border-t border-slate-100 px-3 text-sm font-semibold text-sky-700 hover:bg-sky-50 sm:min-h-10"
        >
          <Plus className="h-4 w-4" />
          {createLabel ?? 'Novo'}
          {search.trim() ? <span className="truncate font-normal text-slate-500">“{search.trim()}”</span> : null}
        </button>
      )}
    </Command>
  );
}

interface ComboboxProps {
  options: ComboOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Rótulo do botão embutido, ex.: "+ Novo cliente" */
  createLabel?: string;
  /** Recebe o texto digitado na busca para pré-preencher o cadastro rápido */
  onCreate?: (search: string) => void;
  invalid?: boolean;
  'aria-label'?: string;
}

/** Select pesquisável com botão de criação inline. */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Selecione…',
  searchPlaceholder = 'Buscar…',
  emptyText = 'Nada encontrado.',
  createLabel,
  onCreate,
  invalid,
  ...rest
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={rest['aria-label']}
          className={cn(triggerCls, invalid && 'ring-rose-400')}
        >
          <span className={cn('truncate', !selected && 'text-slate-400')}>
            {selected ? (
              <>
                <span className="font-medium text-slate-900">{selected.label}</span>
                {selected.hint && <span className="ml-2 text-xs text-slate-400">{selected.hint}</span>}
              </>
            ) : (
              placeholder
            )}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <List
          options={options}
          isSelected={(v) => v === value}
          onSelect={(v) => {
            onChange(v);
            setOpen(false);
          }}
          onCreate={onCreate}
          createLabel={createLabel}
          emptyText={emptyText}
          searchPlaceholder={searchPlaceholder}
          closePopover={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

interface MultiSelectProps {
  options: ComboOption[];
  value: string[];
  onChange: (value: string[]) => void;
  /** Texto quando nada está selecionado (= "todos") */
  allLabel: string;
  searchPlaceholder?: string;
  'aria-label'?: string;
}

/** Multiselect pesquisável; lista vazia significa "sem filtro". */
export function MultiSelect({ options, value, onChange, allLabel, searchPlaceholder = 'Buscar…', ...rest }: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  const summary =
    value.length === 0
      ? allLabel
      : value.length === 1
        ? options.find((o) => o.value === value[0])?.label ?? '1 selecionado'
        : `${value.length} selecionados`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" role="combobox" aria-expanded={open} aria-label={rest['aria-label']} className={triggerCls}>
          <span className={cn('truncate', value.length === 0 ? 'text-slate-500' : 'font-medium text-slate-900')}>{summary}</span>
          <span className="flex items-center gap-1">
            {value.length > 0 && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Limpar seleção"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange([]);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.stopPropagation();
                    onChange([]);
                  }
                }}
                className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <List
          options={options}
          isSelected={(v) => value.includes(v)}
          onSelect={toggle}
          emptyText="Nada encontrado."
          searchPlaceholder={searchPlaceholder}
          closePopover={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
