import * as React from "react"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'success';
  size?: 'default' | 'sm' | 'lg' | 'xl' | 'icon';
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'default', loading, children, disabled, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]";

    const variantStyles = {
      default: "bg-orange-600 text-white hover:bg-orange-700 shadow-sm shadow-orange-600/20 hover:shadow-md hover:shadow-orange-600/25",
      destructive: "bg-red-500 text-white hover:bg-red-600 shadow-sm shadow-red-600/20",
      outline: "border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 hover:border-zinc-300",
      secondary: "bg-zinc-100 text-zinc-900 hover:bg-zinc-200",
      ghost: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
      link: "text-orange-600 underline-offset-4 hover:underline",
      success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-600/20",
    };

    const sizeStyles = {
      default: "h-10 px-5 py-2",
      sm: "h-9 px-3.5 text-xs",
      lg: "h-11 px-6 text-base",
      xl: "h-12 px-8 text-base font-bold",
      icon: "h-10 w-10",
    };

    const isDisabled = disabled || loading;

    return (
      <button
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        ref={ref}
        disabled={isDisabled}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button }
