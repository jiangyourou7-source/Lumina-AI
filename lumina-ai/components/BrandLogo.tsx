type BrandLogoProps = {
  className?: string;
};

export function BrandLogo({ className = "h-6 w-6" }: BrandLogoProps) {
  return (
    <img
      src="/brand/drmina-pocket-logo.png"
      alt=""
      aria-hidden="true"
      className={`${className} object-contain`}
      draggable={false}
    />
  );
}
