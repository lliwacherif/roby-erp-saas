import { Routes, Route } from 'react-router-dom'
import ServiceList from './ServiceList'
import ServiceForm from './ServiceForm'
import ServiceInvoiceBuilder from './ServiceInvoiceBuilder'

export default function ServicePage({ mode }: { mode: 'location' | 'vente' }) {
    return (
        <Routes>
            <Route path="/" element={<ServiceList key={mode} mode={mode} />} />
            <Route path="/new" element={<ServiceForm key={mode} mode={mode} />} />
            <Route path="/:id/invoice" element={<ServiceInvoiceBuilder key={mode} mode={mode} />} />
        </Routes>
    )
}
