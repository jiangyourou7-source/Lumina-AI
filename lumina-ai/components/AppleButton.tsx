import { ButtonHTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";

interface AppleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-9 px-4 text-[15px] rounded-[10px]",
  md: "h-12 px-6 text-[17px] rounded-apple",
  lg: "h-14 px-8 text-[17px] rounded-apple",
};

const variantClasses = {
  primary:
    "bg-brand-primary text-white hover:scale-[1.02] hover:shadow-card active:scale-[0.98]",
  secondary:
    "border border-brand-primary text-brand-primary bg-transparent hover:bg-brand-primary/5 active:scale-[0.98]",
  ghost:
    "text-brand-primary bg-transparent hover:bg-black/5 active:scale-[0.98]",
};

export const AppleButton = forwardRef<HTMLButtonElement, AppleButtonProps>(
  ({ variant = "primary", size = "md", className, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 select-none",
          sizeClasses[size],
          variantClasses[variant],
          disabled && "opacity-50 pointer-events-none",
          className
        )}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    );
  }
);

AppleButton.displayName = "AppleButton";
