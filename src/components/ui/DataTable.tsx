import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
    getPaginationRowModel,
    getSortedRowModel,
    SortingState,
    getFilteredRowModel,
    ColumnFiltersState,
} from '@tanstack/react-table'
import { useState } from 'react'
import { Button } from './Button'
import { Input } from './Input'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
    searchKey?: string
    action?: React.ReactNode
}

export function DataTable<TData, TValue>({
    columns,
    data,
    searchKey,
    action
}: DataTableProps<TData, TValue>) {
    const [sorting, setSorting] = useState<SortingState>([])
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
    const { t } = useI18n()

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnFiltersChange: setColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            sorting,
            columnFilters,
        },
    })

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                {searchKey && (
                    <div className="flex items-center w-72">
                        <Input
                            placeholder={t('filter')}
                            value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ""}
                            onChange={(event) =>
                                table.getColumn(searchKey)?.setFilterValue(event.target.value)
                            }
                        />
                    </div>
                )}
                {action}
            </div>
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <tr key={headerGroup.id} className="bg-slate-50/80">
                                    {headerGroup.headers.map((header) => {
                                        const sorted = header.column.getIsSorted()
                                        return (
                                            <th
                                                key={header.id}
                                                colSpan={header.colSpan}
                                                className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 transition-colors select-none"
                                                onClick={header.column.getToggleSortingHandler()}
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    {header.isPlaceholder
                                                        ? null
                                                        : flexRender(
                                                            header.column.columnDef.header,
                                                            header.getContext()
                                                        )}
                                                    {header.column.getCanSort() && (
                                                        <span className="text-slate-400">
                                                            {sorted === 'asc' ? (
                                                                <ChevronUp className="h-3.5 w-3.5" />
                                                            ) : sorted === 'desc' ? (
                                                                <ChevronDown className="h-3.5 w-3.5" />
                                                            ) : (
                                                                <ChevronsUpDown className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100" />
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                            </th>
                                        )
                                    })}
                                </tr>
                            ))}
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {table.getRowModel().rows?.length ? (
                                table.getRowModel().rows.map((row) => (
                                    <tr
                                        key={row.id}
                                        data-state={row.getIsSelected() && "selected"}
                                        className="hover:bg-blue-50/40 transition-colors duration-150"
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <td key={cell.id} className="px-5 py-3.5 whitespace-nowrap text-sm text-slate-700">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={columns.length} className="h-24 text-center text-sm text-slate-400">
                                        {t('noResults')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="flex items-center justify-between py-2">
                <div className="text-sm text-slate-500">
                    {t('page')} {table.getState().pagination.pageIndex + 1} {t('of')} {table.getPageCount() || 1}
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        {t('previous')}
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        {t('next')}
                    </Button>
                </div>
            </div>
        </div>
    )
}
