import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id || label?.replace(/\s/g, "-").toLowerCase();
    return (
      <div className="space-y-2">
        {label && (
          <label htmlFor={inputId} className="block text-[15px] font-medium text-text-primary">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            "w-full h-12 px-4 rounded-apple border border-[#D1D1D6] bg-white text-[17px] text-text-primary",
            "placeholder:text-text-tertiary",
            "input-focus-ring",
            error && "border-semantic-error",
            className
          )}
          {...props}
        />
        {error && <p className="text-[13px] text-semantic-error">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const textareaId = id || label?.replace(/\s/g, "-").toLowerCase();
    return (
      <div className="space-y-2">
        {label && (
          <label htmlFor={textareaId} className="block text-[15px] font-medium text-text-primary">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={clsx(
            "w-full min-h-[120px] px-4 py-3 rounded-apple border border-[#D1D1D6] bg-white text-[17px] text-text-primary resize-y",
            "placeholder:text-text-tertiary",
            "input-focus-ring",
            error && "border-semantic-error",
            className
          )}
          {...props}
        />
        {error && <p className="text-[13px] text-semantic-error">{error}</p>}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
