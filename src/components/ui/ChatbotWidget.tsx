import { useState, useRef, useEffect } from 'react'
import { Bot, X, Send, Loader2 } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import OpenAI from 'openai'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const SYSTEM_PROMPT = `You are Roby AI, a helpful chatbot that guide users in this app, here it is the architecture of the app:
ROBY ERP: Visual Interface Guide
1. Global Navigation (The Shell)
When a user logs in, they see the main application shell. It consists of:

Top Bar (Header):
Left Side: The ROBY logo and the name of the current Workspace/Store (Tenant).
Center/Right: A Language Selector (switching everything instantly between French and English), and the User Profile dropdown (for logging out or settings).
Main Menu (Sidebar/Top menu depending on device): Contains the core tabs to navigate the app:
📊 Dashboard (KPIs)
👗 Articles (Inventory)
👥 Clients
📝 Services (Sales/Rentals)
🤝 Fournisseurs (Suppliers)
👷 Ouvriers (Workers)
💸 Dépenses (Expenses)
2. The Dashboard (Home Screen)
This is the command center the user sees immediately upon opening the app.

Time Filter: A row of buttons at the top right to filter the entire page's data by: Week, Month, Quarter, Year, All Time.
Four Big Stat Cards:
Revenus (Earnings): Total money made, split visually between Sales and Rentals.
Dépenses (Expenses): Total money spent (bills + payroll).
Bénéfice (Profit): The net positive or negative amount.
Valeur du Stock: The total value of all items sitting in the store.
The Bottom Section:
Quick Stats Box: A small summary showing total clients, workers, and inventory items.
Recent Services List: A quick-glance list of the last 5 transactions (who bought what, when, and for how much).
Low Stock Alert Panel: If any dress or item drops mathematically below 5 units in stock, it flashes here in orange/red to warn the manager to reorder.
3. Inventory (Articles Page)
This is where the store's physical products are managed.

The Tab System: The page is split into three sub-screens using tabs at the top:
Articles: The master list of every physical item. Includes a photo thumbnail, name, color, and live stock count.
Catégories: To group items (e.g., "Robes de Soirée", "Costumes").
Familles: Larger groupings (e.g., "Vêtements Homme", "Vêtements Femme").
Article Actions: Clicking on a specific item lets you:
Edit: Change its price, name, or photo via a pop-up modal.
History: Opens a timeline showing exactly when it was rented, when it was returned, or if stock was manually added/removed.
4. Sales & Rentals (Services Page)
This is the cash register screen.

The Main List: A large table showing all invoices. Each row tells you if it's a Sale or a Rental, the total price, the client's name, and the status (Draft, Confirmed, Returned).
The Cart System (New Service Modal): When clicking "New Service", a large pop-up appears acting like a shopping cart:
Select the Client.
Choose "Sale" or "Rental".
Search and add dresses/items to the cart.
If it's a rental, date pickers appear to choose the start/end dates and the caution (deposit) amount.
Apply any direct discounts.
The system calculates the final total instantly at the bottom.
5. CRM (Clients & Suppliers Pages)
Two very similar screens designed as digital address books.

The List: A clean table showing names, phone numbers, and emails.
Client Specifics:
Import CSV Button: Allows uploading a massive Excel/CSV file of clients instantly.
Client History Button: Clicking an eyeball icon on a client opens a panel showing every single dress they've ever bought or rented from the store.
6. HR & Payroll (Ouvriers Page)
Designed specifically for tracking internal staff logic.

The Worker List: Shows the employee's name, ID card (CIN), Base Salary, and their designated Payday (e.g., "The 5th of every month").
The Alert Banner: If any worker hasn't been paid this month, a big yellow warning banner appears at the top of the screen listing who is owed money.
Status Badges: Next to each worker, a badge tells you if they are "Paid" (Green), "Due Today" (Yellow), or "Overdue" (Red).
Salary Modal: Clicking "Mark as Paid" opens a small box where the manager can add a note (e.g., "Deducted 50 DT for absence") and officially clear the debt, generating a printable "Fiche de Paie" (Payslip).
7. Expenses (Dépenses Page)
A simple ledger screen.

The List: A chronologically sorted table showing where money went out.
Adding an Expense: When clicking "New", the user chooses from a dropdown of categories (Utilities, Software, Store Equipment, Travel, etc.), enters the amount, and adds an optional note/receipt label.
Does this non-technical visual breakdown help map out what the user experiences?

Answer in french always ok`

// Initialize OpenAI client pointing to Scaleway Generative API
const client = new OpenAI({
    baseURL: 'https://api.scaleway.ai/d067acb3-2897-4c85-a126-957eb6768d0b/v1',
    apiKey: import.meta.env.VITE_SCALEWAY_API_KEY || '',
    dangerouslyAllowBrowser: true // Required since we are doing this strictly client-side
})

type Message = {
    role: 'user' | 'assistant'
    content: string
}

export function ChatbotWidget() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { t } = useI18n()
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: 'Bonjour ! Je suis Roby, votre assistant IA. Comment puis-je vous aider avec l\'application aujourd\'hui ?' }
    ])
    const [input, setInput] = useState('')
    const [isTyping, setIsTyping] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Ensure we always scroll to the latest message
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages, isTyping])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim() || isTyping) return

        const userMsg: Message = { role: 'user', content: input.trim() }
        setMessages(prev => [...prev, userMsg])
        setInput('')
        setIsTyping(true)

        try {
            // We append a blank assistant message that we will stream into
            setMessages(prev => [...prev, { role: 'assistant', content: '' }])

            const payloadMessages: any[] = [
                { role: 'system', content: SYSTEM_PROMPT },
                ...messages.map(m => ({ role: m.role, content: m.content })),
                { role: 'user', content: userMsg.content }
            ]

            const stream = await client.chat.completions.create({
                model: 'gpt-oss-120b',
                messages: payloadMessages,
                max_tokens: 512,
                temperature: 1,
                top_p: 1,
                presence_penalty: 0,
                // @ts-ignore - The non-standard scaleway parameter
                reasoning_effort: 'medium',
                response_format: { type: 'text' },
                stream: true,
            })

            let fullContent = ''

            for await (const chunk of stream) {
                const delta = chunk.choices[0]?.delta?.content || ''
                if (delta) {
                    fullContent += delta
                    // Dynamically update the very last message in the array
                    setMessages(prev => {
                        const newMsgs = [...prev]
                        newMsgs[newMsgs.length - 1].content = fullContent
                        return newMsgs
                    })
                }
            }
        } catch (error: any) {
            console.error('Scaleway API Error:', error)
            setMessages(prev => {
                const newMsgs = [...prev]
                newMsgs[newMsgs.length - 1].content = `Erreur: Je n'ai pas pu me connecter à mon serveur (${error.message || 'API indisponible'}).`
                return newMsgs
            })
        } finally {
            setIsTyping(false)
        }
    }

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">

            {/* The Chat Window */}
            {isOpen && (
                <div className="mb-4 w-[350px] sm:w-[400px] h-[500px] max-h-[75vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-300">

                    {/* Header */}
                    <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between shadow-sm shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="bg-white/20 p-1.5 rounded-lg">
                                <Bot className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm">Roby AI</h3>
                                <div className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                                    <p className="text-[10px] text-blue-100 uppercase tracking-wide font-medium">Assistant Virtuel</p>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${msg.role === 'user'
                                    ? 'bg-blue-600 text-white rounded-br-sm shadow-md'
                                    : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm shadow-sm'
                                    }`}>
                                    {msg.content ? (
                                        msg.role === 'user' ? (
                                            msg.content.split('\n').map((line, i) => (
                                                <p key={i} className={i !== 0 ? 'mt-1' : ''}>{line}</p>
                                            ))
                                        ) : (
                                            <div className="prose prose-sm prose-slate max-w-none 
                                                prose-p:my-1 prose-headings:my-2 prose-headings:font-bold 
                                                prose-ul:my-1 prose-li:my-0 prose-strong:font-semibold 
                                                prose-table:border-collapse prose-th:border prose-th:bg-slate-50 prose-th:p-1.5 prose-td:border prose-td:p-1.5"
                                            >
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {msg.content}
                                                </ReactMarkdown>
                                            </div>
                                        )
                                    ) : (
                                        isTyping && msg.role === 'assistant' && (
                                            <div className="flex items-center gap-1.5 h-5 px-1">
                                                <span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                                <span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                                <span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-3 bg-white border-t border-slate-200 shrink-0">
                        <form onSubmit={handleSubmit} className="flex items-center gap-2">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Posez une question..."
                                className="flex-1 bg-slate-100 text-slate-900 text-sm rounded-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-shadow"
                                disabled={isTyping}
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || isTyping}
                                className="bg-blue-600 text-white p-2.5 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                            >
                                {isTyping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            </button>
                        </form>
                    </div>

                </div>
            )}

            {/* Floating Bubble Trigger */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center justify-center h-14 w-14 rounded-full shadow-xl transition-transform hover:scale-105 active:scale-95 ${isOpen ? 'bg-slate-800 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
            >
                {isOpen ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
            </button>
        </div>
    )
}
