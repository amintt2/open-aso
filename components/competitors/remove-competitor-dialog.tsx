"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import Button from "@/components/_ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/_ui/dialog";
import type { Competitor } from "@/lib/competitors/types";

type Target = Pick<Competitor, "id" | "name">;

type Props = {
  competitor: Target | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (competitor: Target) => Promise<void>;
};

export default function RemoveCompetitorDialog({ competitor, onOpenChange, onConfirm }: Props) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={!!competitor} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Remove competitor?</DialogTitle>
          <DialogDescription>{competitor?.name} will no longer be tracked. Your keywords are not affected.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" size="md" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            disabled={busy}
            onClick={async () => {
              if (!competitor) return;
              setBusy(true);
              await onConfirm(competitor);
              setBusy(false);
              onOpenChange(false);
            }}
          >
            {busy && <Loader2 aria-hidden className="size-3.5 animate-spin" />}
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
