type BrandLogoProps = {
  className?: string;
};

export function BrandLogo({ className = "h-6 w-6" }: BrandLogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="28" height="28" rx="9" fill="#007AFF" />
      <path
        d="M7 11.75h18v6.1C25 22.9 21.05 26 16 26S7 22.9 7 17.85v-6.1Z"
        fill="white"
      />
      <path
        d="M9.75 15.3c1.28 2.45 3.55 3.85 6.25 3.85s4.97-1.4 6.25-3.85"
        stroke="#007AFF"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M10.1 11.75c.72-2.45 2.9-4.1 5.9-4.1s5.18 1.65 5.9 4.1H10.1Z"
        fill="#DDF0FF"
      />
      <circle cx="16" cy="11.75" r="1.35" fill="#007AFF" />
      <path
        d="M23.6 6.6l.72 1.55 1.55.72-1.55.72-.72 1.55-.72-1.55-1.55-.72 1.55-.72.72-1.55Z"
        fill="#BFE3FF"
      />
      <path
        d="M8.9 8.5c.8-1.08 1.88-1.85 3.18-2.28"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.72"
      />
    </svg>
  );
}
