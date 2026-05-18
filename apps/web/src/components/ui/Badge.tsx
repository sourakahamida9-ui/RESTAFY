import * as React from "react"

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
  size?: 'sm' | 'md';
  dot?: boolean;
  pulse?: boolean;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className = '', variant = 'default', size = 'sm', dot, pulse, children, ...props }, ref) => {
    const base = "inline-flex items-center gap-1.5 font-semibold rounded-full whitespace-nowrap";

    const variantStyles = {
      default: "bg-zinc-100 text-zinc-700",
      success: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
      warning: "bg-amber-50 text-amber-700 border border-amber-200/60",
      danger: "bg-red-50 text-red-700 border border-red-200/60",
      info: "bg-blue-50 text-blue-700 border border-blue-200/60",
      outline: "border border-zinc-200 text-zinc-600 bg-white",
    };

    const dotColors = {
      default: "bg-zinc-400",
      success: "bg-emerald-500",
      warning: "bg-amber-500",
      danger: "bg-red-500",
      info: "bg-blue-500",
      outline: "bg-zinc-400",
    };

    const sizeStyles = {
      sm: "px-2.5 py-0.5 text-xs",
      md: "px-3 py-1 text-sm",
    };

    return (
      <span
        ref={ref}
        className={`${base} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {dot && (
          <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]} ${pulse ? 'animate-pulse' : ''}`} />
        )}
        {children}
      </span>
    );
  }
);
Badge.displayName = "Badge"

export { Badge }
