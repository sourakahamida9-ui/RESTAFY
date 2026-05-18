import * as React from "react"

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'bordered' | 'glass';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
}

const paddingMap = {
  none: '',
  sm: 'p-4',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-8',
};

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', variant = 'default', padding = 'md', hover = false, children, ...props }, ref) => {
    const base = "rounded-2xl transition-all duration-200";

    const variantStyles = {
      default: "bg-white border border-zinc-100 shadow-sm",
      elevated: "bg-white shadow-md border border-zinc-100/50",
      bordered: "bg-white border border-zinc-200",
      glass: "bg-white/80 backdrop-blur-xl border border-zinc-200/50 shadow-sm",
    };

    const hoverClass = hover
      ? "hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
      : "";

    return (
      <div
        ref={ref}
        className={`${base} ${variantStyles[variant]} ${paddingMap[padding]} ${hoverClass} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card"

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}
const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className = '', ...props }, ref) => (
    <div ref={ref} className={`flex items-center justify-between mb-4 ${className}`} {...props} />
  )
);
CardHeader.displayName = "CardHeader"

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}
const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className = '', ...props }, ref) => (
    <h3 ref={ref} className={`text-base font-semibold text-zinc-900 ${className}`} {...props} />
  )
);
CardTitle.displayName = "CardTitle"

export { Card, CardHeader, CardTitle }
