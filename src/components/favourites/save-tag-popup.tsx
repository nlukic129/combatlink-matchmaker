import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Heart, Plus, Tag, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { tagColor } from "@/lib/tag-utils";

export function tagPopupPositionForAnchor(el: HTMLElement): { top: number; right: number } {
  const rect = el.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const top = spaceBelow > 260 ? rect.bottom + 8 : rect.top - 260 - 8;
  return { top, right: window.innerWidth - rect.right - 4 };
}

export function SaveTagPopup({
  fighterId,
  pos,
  onClose,
}: {
  fighterId: string;
  pos: { top: number; right: number };
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [query, setQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const { data: allTags = [] } = useQuery({
    queryKey: ["all-fav-tags"],
    queryFn: async () => {
      const { data } = await supabase.from("matchmaker_favourites").select("tags");
      const set = new Set<string>();
      for (const row of data ?? []) for (const t of (row.tags ?? []) as string[]) set.add(t);
      return Array.from(set).sort();
    },
    staleTime: 30_000,
  });

  const updateTags = useMutation({
    mutationFn: async (tags: string[]) => {
      await supabase.from("matchmaker_favourites").update({ tags }).eq("fighter_id", fighterId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["favourites"] });
      qc.invalidateQueries({ queryKey: ["all-fav-tags"] });
    },
  });

  function resetTimer() {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(onClose, 7000);
  }

  useEffect(() => {
    resetTimer();
    inputRef.current?.focus();
    return () => clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [onClose]);

  function toggleTag(tag: string) {
    const next = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
    setSelectedTags(next);
    updateTags.mutate(next);
    resetTimer();
  }

  const normalized = query.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const filtered = allTags.filter((t) => !query.trim() || t.includes(query.toLowerCase().trim()));
  const canCreate = normalized.length > 0 && !allTags.includes(normalized);

  function createTag() {
    if (!canCreate) return;
    const next = selectedTags.includes(normalized) ? selectedTags : [...selectedTags, normalized];
    setSelectedTags(next);
    updateTags.mutate(next);
    setQuery("");
    resetTimer();
  }

  return createPortal(
    <div
      ref={containerRef}
      className="fixed z-[9999] w-72 overflow-hidden rounded-2xl border border-border bg-popover shadow-[var(--shadow-elevated)]"
      style={{ top: pos.top, right: pos.right }}
      onPointerMove={resetTimer}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15">
            <Heart className="h-3 w-3 fill-primary text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">Saved!</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground/40 transition-colors hover:text-muted-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="px-4 py-3">
        <p className="mb-2.5 text-xs text-muted-foreground">Added to favourites</p>
        <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50">
          Add a tag
        </p>

        <div className="mb-3 flex items-center gap-2 rounded-lg border border-border/60 bg-surface px-2.5 py-1.5">
          <Tag className="h-3 w-3 shrink-0 text-muted-foreground/40" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              resetTimer();
            }}
            onKeyDown={(e) => e.key === "Enter" && createTag()}
            placeholder="Search or create…"
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
          />
        </div>

        {canCreate && (
          <button
            type="button"
            onClick={createTag}
            className="mb-2 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-primary transition-colors hover:bg-accent"
          >
            <Plus className="h-3 w-3" />
            Create &ldquo;#{normalized}&rdquo;
          </button>
        )}

        <div className="flex flex-wrap gap-1.5">
          {filtered.length === 0 && !canCreate && (
            <p className="py-2 text-xs text-muted-foreground/40">
              {allTags.length === 0 ? "Type to create your first tag" : "No matches"}
            </p>
          )}
          {filtered.map((tag) => {
            const isOn = selectedTags.includes(tag);
            const c = tagColor(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
                  isOn ? "opacity-100" : "opacity-55 hover:opacity-90",
                )}
                style={{
                  backgroundColor: c.bg,
                  color: c.text,
                  borderColor: c.border,
                  ...(isOn && { outline: `1px solid ${c.border}`, outlineOffset: "2px" }),
                }}
              >
                {isOn && <Check className="h-2.5 w-2.5 shrink-0" />}
                #{tag}
              </button>
            );
          })}
        </div>
      </div>

      {selectedTags.length > 0 && (
        <div className="border-t border-border px-4 pb-3 pt-2.5">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-primary py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Done
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}
