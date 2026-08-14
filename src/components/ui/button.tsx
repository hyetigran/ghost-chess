import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Pressable } from 'react-native';
import { TextClassContext } from '~/components/ui/text';
import { cn } from '~/lib/style/utils';

// Button spec from the mockup foundations sheet: 56px tall, radius 18,
// Manrope ExtraBold label, raised accent shadow; pressed = darker accent
// + scale .98; disabled = solid accentDisabled fill (not an opacity dim).
const buttonVariants = cva(
  'group flex items-center justify-center rounded-control web:ring-offset-background web:transition-colors web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring web:focus-visible:ring-offset-2 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-primary shadow-raised web:hover:bg-accentPressed active:bg-accentPressed',
        destructive: 'bg-destructive web:hover:opacity-90 active:opacity-90',
        outline:
          'border-[1.5px] border-borderStrong bg-transparent web:hover:bg-accent active:bg-accent',
        secondary: 'bg-card border border-border shadow-card active:opacity-90',
        ghost:
          'web:hover:bg-accent web:hover:text-accent-foreground active:bg-accent',
        link: 'web:underline-offset-4 web:hover:underline web:focus:underline ',
      },
      size: {
        default: 'h-14 px-5',
        sm: 'h-11 px-4 rounded-chip',
        lg: 'h-14 px-8',
        icon: 'h-11 w-11 rounded-strip',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

const buttonTextVariants = cva('web:whitespace-nowrap web:transition-colors', {
  variants: {
    variant: {
      default: 'font-sans-extrabold text-primary-foreground',
      destructive: 'font-sans-extrabold text-destructive-foreground',
      outline: 'font-sans-bold text-foreground',
      secondary: 'font-sans-bold text-foreground',
      ghost: 'font-sans-semibold text-muted-foreground',
      link: 'font-sans-semibold text-primary group-active:underline',
    },
    size: {
      default: 'text-[17px]',
      sm: 'text-[15px]',
      lg: 'text-lg',
      icon: 'text-lg',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

type ButtonProps = React.ComponentPropsWithoutRef<typeof Pressable> &
  VariantProps<typeof buttonVariants>;

const Button = React.forwardRef<
  React.ElementRef<typeof Pressable>,
  ButtonProps
>(({ className, variant, size, ...props }, ref) => {
  const isSolid = variant === 'default' || variant === undefined;
  return (
    <TextClassContext.Provider
      value={cn(
        buttonTextVariants({ variant, size }),
        props.disabled &&
          (isSolid ? 'text-[#F0F4EC] web:pointer-events-none' : 'web:pointer-events-none'),
      )}
    >
      <Pressable
        className={cn(
          buttonVariants({ variant, size, className }),
          props.disabled &&
            (isSolid
              ? 'bg-accentDisabled shadow-none web:pointer-events-none'
              : 'opacity-50 web:pointer-events-none'),
        )}
        ref={ref}
        role='button'
        {...props}
      />
    </TextClassContext.Provider>
  );
});
Button.displayName = 'Button';

export { Button, buttonTextVariants, buttonVariants };
export type { ButtonProps };
