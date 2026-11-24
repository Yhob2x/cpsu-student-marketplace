import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";

/** The same three variants and three control heights on every responsive surface. */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-[var(--ui-radius-sm)] border border-transparent font-bold transition-colors select-none touch-manipulation focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 active:not-disabled:brightness-95 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-[var(--color-primary-dark)]",
        secondary: "border-border bg-secondary text-secondary-foreground hover:bg-muted",
        ghost: "bg-transparent text-primary hover:bg-muted",
      },
      size: {
        sm: "min-h-[44px] gap-2 px-3 text-sm [&_svg:not([class*='size-'])]:size-4",
        md: "min-h-[48px] gap-2 px-4 text-base [&_svg:not([class*='size-'])]:size-5",
        lg: "min-h-[56px] gap-3 px-6 text-lg [&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

function Button({
  className,
  variant = "primary",
  size = "md",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp
    data-slot="button"
    data-variant={variant}
    data-size={size}
    className={cn(buttonVariants({ variant, size, className }))}
    {...props}
  />;
}

export { Button, buttonVariants };
