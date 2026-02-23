import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X } from 'lucide-react'

export function Drawer({ isOpen, onClose, title, children, size = 'md' }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode, size?: 'md' | 'xl' | '2xl' | 'full' }) {
    const sizeClasses = {
        'md': 'max-w-md',
        'xl': 'max-w-xl',
        '2xl': 'max-w-2xl',
        'full': 'max-w-full'
    }

    return (
        <Transition.Root show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-in-out duration-500"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in-out duration-500"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-hidden">
                    <div className="absolute inset-0 overflow-hidden">
                        <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
                            <Transition.Child
                                as={Fragment}
                                enter="transform transition ease-in-out duration-500 sm:duration-700"
                                enterFrom="translate-x-full"
                                enterTo="translate-x-0"
                                leave="transform transition ease-in-out duration-500 sm:duration-700"
                                leaveFrom="translate-x-0"
                                leaveTo="translate-x-full"
                            >
                                <Dialog.Panel className={`pointer-events-auto w-screen ${sizeClasses[size]}`}>
                                    <div className="flex h-full flex-col overflow-y-scroll bg-slate-50 shadow-2xl">
                                        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5">
                                            <div className="flex items-center justify-between">
                                                <Dialog.Title className="text-base font-semibold leading-6 text-white">
                                                    {title}
                                                </Dialog.Title>
                                                <button
                                                    type="button"
                                                    className="rounded-lg p-1.5 text-blue-200 hover:text-white hover:bg-blue-500/30 transition-colors duration-200 focus:outline-none"
                                                    onClick={onClose}
                                                >
                                                    <span className="sr-only">Close panel</span>
                                                    <X className="h-5 w-5" aria-hidden="true" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="relative flex-1">
                                            {children}
                                        </div>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </div>
            </Dialog>
        </Transition.Root >
    )
}
