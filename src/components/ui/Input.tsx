import clsx from 'clsx'
import { forwardRef, InputHTMLAttributes } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string
    error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, label, error, ...props }, ref) => {
    return (
        <div className='w-full'>
            {label && (
                <label
                    htmlFor={props.id || props.name}
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                    {label}
                </label>
            )}
            <input
                ref={ref}
                className={clsx(
                    'block w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400',
                    'shadow-sm transition-all duration-200',
                    'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none',
                    'hover:border-slate-300',
                    error && 'border-red-300 focus:border-red-500 focus:ring-red-500/20',
                    className
                )}
                {...props}
            />
            {error && <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">{error}</p>}
        </div>
    )
})
Input.displayName = 'Input'
