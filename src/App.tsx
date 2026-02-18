import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/lib/auth'
import { TenantProvider } from '@/lib/tenant'
import { I18nProvider } from '@/lib/i18n'
import LoginPage from '@/app/auth/LoginPage'
import { RequireAuth } from '@/components/auth/RequireAuth'
import AppLayout from '@/components/layout/AppLayout'
import RootLayout from '@/components/layout/RootLayout'
import ArticlePage from '@/app/articles/ArticlePage'
import StockPage from '@/app/stock/StockPage'
import ServicePage from '@/app/services/ServicePage'
import DepensePage from '@/app/depenses/DepensePage'
import OuvrierPage from '@/app/ouvriers/OuvrierPage'
import TenantListPage from '@/app/root/TenantListPage'
import KpiPage from '@/app/kpi/KpiPage'
import ClientList from '@/app/clients/ClientList'
import ClientForm from '@/app/clients/ClientForm'
import ClientHistoryPage from '@/app/clients/ClientHistoryPage'

function App() {
  return (
    <Router>
      <I18nProvider>
        <AuthProvider>
          <TenantProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              {/* Root Console Routes */}
              <Route path="/root" element={
                <RequireAuth>
                  <RootLayout />
                </RequireAuth>
              }>
                <Route path="tenants" element={<TenantListPage />} />
                <Route index element={<Navigate to="tenants" replace />} />
              </Route>

              {/* Tenant App Routes */}
              <Route path="/app" element={
                <RequireAuth>
                  <AppLayout />
                </RequireAuth>
              }>
                <Route path="kpi" element={<KpiPage />} />
                <Route path="articles" element={<ArticlePage />} />
                <Route path="stock" element={<StockPage />} />
                <Route path="services/*" element={<ServicePage />} />
                <Route path="clients" element={<ClientList />} />
                <Route path="clients/new" element={<ClientForm />} />
                <Route path="clients/:id" element={<ClientForm />} />
                <Route path="clients/:id/history" element={<ClientHistoryPage />} />
                <Route path="depenses" element={<DepensePage />} />
                <Route path="ouvriers" element={<OuvrierPage />} />
                <Route index element={<Navigate to="kpi" replace />} />
              </Route>

              <Route path="/" element={<Navigate to="/app" replace />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </TenantProvider>
        </AuthProvider>
      </I18nProvider>
    </Router>
  )
}

export default App
