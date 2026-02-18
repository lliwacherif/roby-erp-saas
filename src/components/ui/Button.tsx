import { clsx } from 'clsx'
import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
    size?: 'sm' | 'md' | 'lg'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
        <button
            ref={ref}
            className={clsx(
                'inline-flex items-center justify-center font-medium transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]',
                {
                    // Primary — gradient blue
                    'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md shadow-blue-500/25 hover:from-blue-700 hover:to-blue-800 hover:shadow-lg hover:shadow-blue-500/30 focus:ring-blue-500 rounded-lg': variant === 'primary',
                    // Secondary — subtle gray
                    'bg-white text-slate-700 border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-slate-300 focus:ring-blue-500 rounded-lg': variant === 'secondary',
                    // Danger — red
                    'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-md shadow-red-500/25 hover:from-red-600 hover:to-red-700 hover:shadow-lg hover:shadow-red-500/30 focus:ring-red-500 rounded-lg': variant === 'danger',
                    // Ghost — transparent
                    'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:ring-blue-500 rounded-lg': variant === 'ghost',
                    // Sizes
                    'px-3 py-1.5 text-xs gap-1.5 rounded-md': size === 'sm',
                    'px-4 py-2 text-sm gap-2': size === 'md',
                    'px-6 py-2.5 text-base gap-2.5': size === 'lg',
                },
                className
            )}
            {...props}
        />
    )
})
Button.displayName = 'Button'
