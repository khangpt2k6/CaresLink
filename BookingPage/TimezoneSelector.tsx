import { useState, useRef, useMemo } from 'react';
import { Globe, Search, Check } from 'lucide-react';
import { filterTimezones } from '@/components/CalendarSidebar/EventEditorPanel/timezones';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/UI';

interface TimezoneSelectorProps {
  timezone: string;
  onChange: (timezone: string) => void;
}

function getShortAbbrev(timezone: string): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'short',
  }).formatToParts(now);
  const tzPart = parts.find((p) => p.type === 'timeZoneName');
  return tzPart?.value ?? '';
}

export function TimezoneSelector({ timezone, onChange }: TimezoneSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => filterTimezones(query), [query]);
  const shortAbbrev = getShortAbbrev(timezone);

  return (
    <div>
      <div className="text-[11px] font-semibold text-foreground-secondary mb-1">Time zone</div>
      <DropdownMenu
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setQuery('');
        }}
      >
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 w-full rounded-lg border border-border px-2.5 py-1.5 text-xs text-foreground-secondary hover:text-foreground hover:border-border-strong transition-colors"
          >
            <Globe className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 text-left font-medium truncate">{shortAbbrev}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side="bottom"
          sideOffset={4}
          className="w-72 p-0"
        >
          <div className="flex items-center gap-2 px-2 py-2 border-b border-border">
            <Search className="w-4 h-4 text-foreground-muted flex-shrink-0 ml-0.5" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search timezone..."
              className="flex-1 text-sm text-primary placeholder-foreground-muted bg-transparent border-0 p-0 focus:outline-none focus:ring-0"
            />
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-2 py-2 text-sm text-primary">No timezones found</div>
            ) : (
              filtered.map((tz) => {
                const isSelected = timezone === tz.id;
                return (
                  <DropdownMenuItem
                    key={tz.id}
                    onSelect={() => onChange(tz.id)}
                    className={`gap-2 text-sm ${isSelected ? 'bg-accent-light' : ''}`}
                  >
                    <span className="text-foreground-secondary w-20 flex-shrink-0">{tz.offset}</span>
                    <span className="truncate flex-1">
                      {tz.name} - {tz.city}
                    </span>
                    {isSelected && <Check className="h-4 w-4 text-accent flex-shrink-0" />}
                  </DropdownMenuItem>
                );
              })
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
