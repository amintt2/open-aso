import { cn } from "@/lib/utils";

export default function UserAvatar({
  name,
  image,
  className,
}: {
  name: string;
  image?: string | null;
  className?: string;
}) {
  const initials = name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  if (image)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        referrerPolicy="no-referrer"
        className={cn(
          "size-7 shrink-0 rounded-full border border-white/8 object-cover",
          className,
        )}
      />
    );
  return (
    <span
      className={cn(
        "bg-muted text-soft inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-medium",
        className,
      )}
    >
      {initials || "?"}
    </span>
  );
}

export function WorkspaceMark({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "bg-primary inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-[13px] font-medium text-white shadow-[inset_0px_1px_0px_rgba(255,255,255,0.2)]",
        className,
      )}
    >
      {name.trim().slice(0, 1).toUpperCase() || "W"}
    </span>
  );
}
