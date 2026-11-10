import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default: 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20 hover:bg-sky-400',
        secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200',
        outline: 'bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50',
        ghost: 'text-slate-600 hover:bg-slate-100',
        destructive: 'bg-rose-600 text-white hover:bg-rose-500',
      },
      size: {
        default: 'h-11 px-4 sm:h-10',
        sm: 'h-9 px-3 text-xs',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
);
Button.displayName = 'Button';

export { Button, buttonVariants };
