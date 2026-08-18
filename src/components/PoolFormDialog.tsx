import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { computeResetAt } from "@/db/defaults";
import type { Pool, PoolDraft, PoolType, ResetCycle } from "@/db/schema";

const TYPES: PoolType[] = ["credits", "requests", "usd", "custom"];
const CYCLES: ResetCycle[] = ["weekly", "monthly", "none"];

type Props = {
  open: boolean;
  pool: Pool | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (draft: PoolDraft) => void;
};

export function PoolFormDialog({ open, pool, onOpenChange, onSubmit }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<PoolDraft>(emptyDraft());

  useEffect(() => {
    if (open) {
      setDraft(pool ? fromPool(pool) : emptyDraft());
    }
  }, [open, pool]);

  function handleCycle(cycle: ResetCycle) {
    setDraft((prev) => ({
      ...prev,
      reset_cycle: cycle,
      reset_at: computeResetAt(cycle),
    }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft.name.trim() || draft.quota_total < 0) return;
    onSubmit({
      ...draft,
      name: draft.name.trim(),
      reset_at: computeResetAt(draft.reset_cycle),
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{pool ? t("pool.edit") : t("dashboard.addPool")}</DialogTitle>
            <DialogDescription>{t("app.tagline")}</DialogDescription>
          </DialogHeader>
          <Field label={t("form.name")}>
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("form.type")}>
              <Select
                value={draft.type}
                onValueChange={(value) => setDraft({ ...draft, type: value as PoolType })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`form.types.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("form.resetCycle")}>
              <Select value={draft.reset_cycle} onValueChange={(v) => handleCycle(v as ResetCycle)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CYCLES.map((cycle) => (
                    <SelectItem key={cycle} value={cycle}>
                      {t(`form.cycles.${cycle}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("form.quotaTotal")}>
              <Input
                type="number"
                min={0}
                step="any"
                value={draft.quota_total}
                onChange={(e) =>
                  setDraft({ ...draft, quota_total: Number(e.target.value) })
                }
                required
              />
            </Field>
            <Field label={t("form.quotaUsed")}>
              <Input
                type="number"
                min={0}
                step="any"
                value={draft.quota_used}
                onChange={(e) =>
                  setDraft({ ...draft, quota_used: Number(e.target.value) })
                }
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("form.unit")}>
              <Input
                value={draft.unit}
                onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                required
              />
            </Field>
            <Field label={t("form.color")}>
              <Input
                type="color"
                value={draft.color}
                onChange={(e) => setDraft({ ...draft, color: e.target.value })}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("form.cancel")}
            </Button>
            <Button type="submit">{pool ? t("form.save") : t("form.create")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function emptyDraft(): PoolDraft {
  return {
    name: "",
    type: "custom",
    quota_total: 100,
    quota_used: 0,
    reset_cycle: "weekly",
    reset_at: computeResetAt("weekly"),
    unit: "credits",
    color: "#38bdf8",
  };
}

function fromPool(pool: Pool): PoolDraft {
  return {
    name: pool.name,
    type: pool.type,
    quota_total: pool.quota_total,
    quota_used: pool.quota_used,
    reset_cycle: pool.reset_cycle,
    reset_at: pool.reset_at,
    unit: pool.unit,
    color: pool.color,
  };
}
