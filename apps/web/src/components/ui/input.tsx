import * as React from "react"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', type, label, error, icon, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-zinc-700 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
              {icon}
            </div>
          )}
          <input
            id={inputId}
            type={type}
            className={`flex h-11 w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-zinc-50 transition-all duration-200 ${error ? 'border-red-300 focus:ring-red-500/30 focus:border-red-400' : 'border-zinc-200 hover:border-zinc-300'} ${icon ? 'pl-10' : ''} ${className}`}
            ref={ref}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-1.5 text-xs text-red-500 font-medium">{error}</p>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
