import { Routes, Route } from 'react-router-dom'
import ServiceList from './ServiceList'
import ServiceForm from './ServiceForm'
import ServiceInvoiceBuilder from './ServiceInvoiceBuilder'

export default function ServicePage() {
    return (
        <Routes>
            <Route path="/" element={<ServiceList />} />
            <Route path="/new" element={<ServiceForm />} />
            <Route path="/:id/invoice" element={<ServiceInvoiceBuilder />} />
        </Routes>
    )
}
