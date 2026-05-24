import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { buttonVariants, type ButtonSize, type ButtonVariant } from './button-variants'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return <button ref={ref} className={buttonVariants({ variant, size, className })} {...props} />
  },
)
Button.displayName = 'Button'
