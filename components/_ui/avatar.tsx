import Asset from "@/components/_ui/asset";
import { cn } from "@/lib/utils";

type AvatarProps = {
  src: string;
  alt: string;
  className?: string;
};

export default function Avatar({ src, alt, className }: AvatarProps) {
  return (
    <Asset
      type="image"
      src={src}
      alt={alt}
      width={1}
      height={1}
      sizes="48px"
      className={cn(
        "size-5 shrink-0 rounded-full bg-[#f2f2f2] outline-1 -outline-offset-1 outline-white/10",
        className,
      )}
    />
  );
}
