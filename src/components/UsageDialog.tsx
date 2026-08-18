import { useState, type FormEvent } from "react";
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
import type { Pool } from "@/db/schema";

type Props = {
  open: boolean;
  pools: Pool[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (poolId: string, amount: number, note: string | null) => void;
};

export function UsageDialog({ open, pools, onOpenChange, onSubmit }: Props) {
  const { t } = useTranslation();
  const [poolId, setPoolId] = useState(pools[0]?.id ?? "");
  const [amount, setAmount] = useState("1");
  const [note, setNote] = useState("");

  function handleOpen(next: boolean) {
    if (next) {
      setPoolId(pools[0]?.id ?? "");
      setAmount("1");
      setNote("");
    }
    onOpenChange(next);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const value = Number(amount);
    if (!poolId || Number.isNaN(value) || value === 0) return;
    onSubmit(poolId, value, note.trim() || null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t("dashboard.recordUsage")}</DialogTitle>
            <DialogDescription>{t("dashboard.subtitle")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label>{t("form.pool")}</Label>
            <Select value={poolId} onValueChange={setPoolId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pools.map((pool) => (
                  <SelectItem key={pool.id} value={pool.id}>
                    {pool.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("form.amount")}</Label>
            <Input
              type="number"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("form.note")}</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("form.cancel")}
            </Button>
            <Button type="submit">{t("form.save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
