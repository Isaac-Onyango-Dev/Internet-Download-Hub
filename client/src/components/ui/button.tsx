import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * Button treatment follows the download site: one warm accent owns primary
 * actions so they read against the cool dark chrome, everything else stays
 * neutral. `hover-elevate` / `active-elevate-2` are defined in index.css and
 * carry the site's bouncy press.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium' +
    ' focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2' +
    ' focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50' +
    ' [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0' +
    ' hover-elevate active-elevate-2',
  {
    variants: {
      variant: {
        // The primary action. Flat warm accent; the gradient version is the
        // `hero` variant below, reserved for the main call to action.
        default:
          'border border-transparent bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.32)]',
        // The hero call to action, lifted from the site's .btn-hot: the warm
        // gradient, the display face and the bouncy lift. One per screen.
        hero:
          'border-0 bg-hot text-primary-foreground font-display font-extrabold tracking-tight' +
          ' shadow-hot hover:shadow-hot-lift disabled:shadow-none',
        destructive:
          'border border-transparent bg-destructive text-destructive-foreground',
        outline:
          // Shows the background color of whatever card / sidebar / accent background it is inside of.
          // Inherits the current text color.
          'border border-border-lift bg-transparent hover:bg-muted',
        secondary: 'border border-border bg-secondary text-secondary-foreground',
        // Add a transparent border so that when someone toggles a border on later, it doesn't shift layout/size.
        ghost: 'border border-transparent hover:bg-muted',
      },
      // Heights are set as "min" heights, because sometimes Ai will place large amount of content
      // inside buttons. With a min-height they will look appropriate with small amounts of content,
      // but will expand to fit large amounts of content.
      size: {
        default: 'min-h-9 px-4 py-2',
        sm: 'min-h-8 rounded-sm px-3 text-xs',
        lg: 'min-h-11 rounded-md px-8 text-base',
        icon: 'h-9 w-9 rounded-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
