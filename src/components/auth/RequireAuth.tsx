import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { ReactNode, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function RequireAuth({ children }: { children: ReactNode }) {
    const { session, loading } = useAuth()
    const location = useLocation()
    const [timedOut, setTimedOut] = useState(false)

    useEffect(() => {
        if (loading) {
            const timer = setTimeout(() => setTimedOut(true), 3000)
            return () => clearTimeout(timer)
        }
    }, [loading])

    if (loading) {
        if (timedOut) {
            // Session is stuck, force clear and redirect
            supabase.auth.signOut()
            return <Navigate to="/login" replace />
        }
        return <div>Loading...</div>
    }

    if (!session) {
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    return <>{children}</>
}
