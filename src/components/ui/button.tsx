import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-bold ring-offset-background transition-all duration-300 ease-[var(--ease-spring)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-azki-button hover:-translate-y-0.5 hover:bg-primary/95 hover:shadow-azki-button-hover',
        destructive: 'bg-destructive text-destructive-foreground shadow-soft hover:-translate-y-0.5 hover:bg-destructive/90 hover:shadow-book',
        outline: 'border border-primary/18 bg-card text-primary shadow-azki-card hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/8 hover:shadow-azki-card-hover',
        secondary: 'bg-secondary/12 text-secondary shadow-soft hover:-translate-y-0.5 hover:bg-secondary/18',
        ghost: 'text-muted-foreground hover:-translate-y-0.5 hover:bg-primary/8 hover:text-primary',
        link: 'text-primary underline-offset-4 hover:underline',
        glow: 'bg-primary text-primary-foreground shadow-azki-button animate-pulse-glow hover:-translate-y-0.5 hover:shadow-azki-button-hover',
      },
      size: {
        default: 'h-11 px-5 py-2.5',
        sm: 'h-9 px-4',
        lg: 'h-12 px-8 text-base',
        icon: 'h-11 w-11 rounded-2xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
