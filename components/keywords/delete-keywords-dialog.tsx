"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/_ui/dialog";
import Button from "@/components/_ui/button";
import type { TrackedKeyword } from "@/lib/client/types";

type Props = {
  keywords: TrackedKeyword[];
  onCancel: () => void;
  onConfirm: () => void;
};

export default function DeleteKeywordsDialog({
  keywords,
  onCancel,
  onConfirm,
}: Props) {
  const single = keywords.length === 1;
  return (
    <Dialog
      open={keywords.length > 0}
      onOpenChange={(open) => !open && onCancel()}
    >
      <DialogContent className="max-w-[420px]">
        <div className="flex flex-col gap-5 p-5">
          <div className="flex flex-col gap-2 pr-8">
            <DialogTitle className="h2-style">
              {single
                ? "Delete keyword?"
                : `Delete ${keywords.length} keywords?`}
            </DialogTitle>
            <DialogDescription className="text-subtle p-style">
              {single ? `“${keywords[0].term}”` : "These keywords"} and{" "}
              {single ? "its" : "their"} ranking history will be removed from
              this app.
            </DialogDescription>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="md" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              className="bg-danger hover:bg-danger/90 text-background"
              onClick={onConfirm}
              autoFocus
            >
              Delete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
