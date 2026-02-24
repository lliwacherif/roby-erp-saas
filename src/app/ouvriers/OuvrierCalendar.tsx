import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/tenant'
import { useI18n } from '@/lib/i18n'
import type { Database } from '@/types/db'
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock, CalendarDays } from 'lucide-react'

type Attendance = Database['public']['Tables']['ouvrier_attendance']['Row']

interface OuvrierCalendarProps {
    ouvrierId: string
}

const STATUS_CONFIG = {
    Present: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200', icon: CheckCircle2 },
    Absent: { color: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200', icon: XCircle },
    Leave: { color: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200', icon: CalendarDays },
    Late: { color: 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200', icon: Clock }
}

export function OuvrierCalendar({ ouvrierId }: OuvrierCalendarProps) {
    const { currentTenant } = useTenant()
    const { t } = useI18n()
    const [currentDate, setCurrentDate] = useState(new Date())
    const [attendances, setAttendances] = useState<Record<string, Attendance>>({})
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (currentTenant && ouvrierId) {
            fetchAttendance()
        }
    }, [currentTenant, ouvrierId, currentDate])

    const fetchAttendance = async () => {
        if (!currentTenant) return
        setLoading(true)

        // Get the start and end of the current month
        const year = currentDate.getFullYear()
        const month = currentDate.getMonth()
        const startDate = new Date(year, month, 1).toISOString().split('T')[0]
        const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0]

        const { data, error } = await supabase
            .from('ouvrier_attendance')
            .select('*')
            .eq('tenant_id', currentTenant.id)
            .eq('ouvrier_id', ouvrierId)
            .gte('date', startDate)
            .lte('date', endDate)

        if (!error && data) {
            const attMap: Record<string, Attendance> = {}
            data.forEach(att => {
                attMap[att.date] = att
            })
            setAttendances(attMap)
        }
        setLoading(false)
    }

    const handleSetAttendance = async (dateStr: string, status: 'Present' | 'Absent' | 'Leave' | 'Late') => {
        if (!currentTenant) return

        const existing = attendances[dateStr]
        let error;

        // Toggling off logic
        if (existing && existing.status === status) {
            const res = await supabase.from('ouvrier_attendance').delete().eq('id', existing.id)
            error = res.error
        } else if (existing) {
            const res = await supabase.from('ouvrier_attendance').update({ status }).eq('id', existing.id)
            error = res.error
        } else {
            const res = await supabase.from('ouvrier_attendance').insert({
                tenant_id: currentTenant.id,
                ouvrier_id: ouvrierId,
                date: dateStr,
                status
            })
            error = res.error
        }

        if (!error) {
            fetchAttendance()
        } else {
            alert(error.message)
        }
    }

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    }

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    }

    const renderCalendar = () => {
        const year = currentDate.getFullYear()
        const month = currentDate.getMonth()

        const firstDay = new Date(year, month, 1).getDay()
        const daysInMonth = new Date(year, month + 1, 0).getDate()

        // Adjust grid for Mon-Sun week (0=Sun, so we shift)
        const startOffset = firstDay === 0 ? 6 : firstDay - 1

        const days = []
        for (let i = 0; i < startOffset; i++) {
            days.push(<div key={`empty-${i}`} className="p-2 border border-slate-100 bg-slate-50/50 hidden sm:block"></div>)
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
            const att = attendances[dateStr]
            const isToday = dateStr === new Date().toISOString().split('T')[0]

            days.push(
                <div key={dateStr} className={`min-h-[80px] sm:min-h-[100px] border border-slate-200 p-1 sm:p-2 bg-white flex flex-col relative group transition-all hover:shadow-md z-10 hover:z-20 ${isToday ? 'ring-2 ring-blue-400 ring-inset bg-blue-50/10' : ''}`}>
                    <div className="flex justify-between items-start mb-1">
                        <span className={`text-xs sm:text-sm font-semibold rounded-full w-6 h-6 flex items-center justify-center ${isToday ? 'bg-blue-500 text-white' : 'text-slate-600'}`}>{d}</span>
                    </div>

                    {att ? (
                        <div className={`mt-auto text-[10px] sm:text-xs font-medium py-1 sm:py-1.5 px-1 sm:px-2 rounded border flex flex-col gap-0.5 items-center sm:items-start text-center sm:text-left cursor-pointer transition-colors ${STATUS_CONFIG[att.status as keyof typeof STATUS_CONFIG].color}`}>
                            {t(att.status.toLowerCase() as any) || att.status}
                        </div>
                    ) : (
                        <div className="mt-auto hidden group-hover:flex gap-1 justify-between px-1">
                            {/* Quick Action Buttons */}
                            <button onClick={() => handleSetAttendance(dateStr, 'Present')} title={t('present')} className="p-1 rounded bg-slate-100 text-emerald-600 hover:bg-emerald-100 hover:scale-110 transition-transform"><CheckCircle2 className="h-3.5 w-3.5" /></button>
                            <button onClick={() => handleSetAttendance(dateStr, 'Absent')} title={t('absent')} className="p-1 rounded bg-slate-100 text-red-600 hover:bg-red-100 hover:scale-110 transition-transform"><XCircle className="h-3.5 w-3.5" /></button>
                            <button onClick={() => handleSetAttendance(dateStr, 'Leave')} title={t('leave')} className="p-1 rounded bg-slate-100 text-blue-600 hover:bg-blue-100 hover:scale-110 transition-transform"><CalendarDays className="h-3.5 w-3.5" /></button>
                            <button onClick={() => handleSetAttendance(dateStr, 'Late')} title={t('late')} className="hidden sm:block p-1 rounded bg-slate-100 text-amber-600 hover:bg-amber-100 hover:scale-110 transition-transform"><Clock className="h-3.5 w-3.5" /></button>
                        </div>
                    )}
                </div>
            )
        }

        return days
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-blue-600" />
                    {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h3>
                <div className="flex gap-1">
                    <button onClick={prevMonth} className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"><ChevronLeft className="h-4 w-4" /></button>
                    <button onClick={nextMonth} className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"><ChevronRight className="h-4 w-4" /></button>
                </div>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 bg-white text-center text-xs font-semibold text-slate-400 py-2 border-b border-slate-200 uppercase tracking-wider hidden sm:grid">
                <div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div><div>Sun</div>
            </div>

            {/* Calendar Grid */}
            <div className={`grid grid-cols-2 sm:grid-cols-7 bg-slate-100 gap-[1px] ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
                {renderCalendar()}
            </div>

            {/* Legend */}
            <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-200 flex flex-wrap gap-4 text-xs">
                <span className="flex items-center gap-1.5 font-medium text-emerald-700"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> {t('present')}</span>
                <span className="flex items-center gap-1.5 font-medium text-red-700"><span className="w-2 h-2 rounded-full bg-red-500"></span> {t('absent')}</span>
                <span className="flex items-center gap-1.5 font-medium text-blue-700"><span className="w-2 h-2 rounded-full bg-blue-500"></span> {t('leave')}</span>
                <span className="flex items-center gap-1.5 font-medium text-amber-700"><span className="w-2 h-2 rounded-full bg-amber-500"></span> {t('late')}</span>
            </div>
        </div>
    )
}
