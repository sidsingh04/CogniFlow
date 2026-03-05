interface Ticket {
    issueId: string;
    code: string;
    issueDate: string;
    slaDeadline: string;
    status: string;
}

interface BreachedAgentTicketsModalProps {
    isOpen: boolean;
    onClose: () => void;
    agentId: string;
    tickets: Ticket[];
}

export default function BreachedAgentTicketsModal({ isOpen, onClose, agentId, tickets }: BreachedAgentTicketsModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-[var(--bg-primary)] w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-[var(--border-primary)]">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[var(--border-secondary)] bg-[var(--bg-secondary)]">
                    <div>
                        <h2 className="text-xl font-bold text-[var(--text-primary)]">Breached Tickets</h2>
                        <p className="text-sm text-[var(--text-muted)] mt-1">Viewing history for Agent: <span className="font-semibold text-[var(--accent-primary)]">{agentId}</span></p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-full transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {tickets.length > 0 ? (
                        <div className="border border-[var(--border-secondary)] rounded-xl overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-[var(--bg-secondary)] border-b border-[var(--border-secondary)]">
                                        <th className="p-4 font-semibold text-sm text-[var(--text-secondary)] whitespace-nowrap">Ticket ID</th>
                                        <th className="p-4 font-semibold text-sm text-[var(--text-secondary)] whitespace-nowrap">Code</th>
                                        <th className="p-4 font-semibold text-sm text-[var(--text-secondary)] whitespace-nowrap">Issue Time</th>
                                        <th className="p-4 font-semibold text-sm text-[var(--text-secondary)] whitespace-nowrap">SLA Breached Time</th>
                                        <th className="p-4 font-semibold text-sm text-[var(--text-secondary)] whitespace-nowrap">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tickets.map((ticket, idx) => (
                                        <tr key={`${ticket.issueId}-${idx}`} className="border-b border-[var(--border-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors">
                                            <td className="p-4 font-medium text-[var(--text-primary)] whitespace-nowrap">
                                                {ticket.issueId}
                                            </td>
                                            <td className="p-4 whitespace-nowrap">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-secondary)]">
                                                    {ticket.code}
                                                </span>
                                            </td>
                                            <td className="p-4 text-[var(--text-secondary)] whitespace-nowrap">
                                                {new Date(ticket.issueDate).toLocaleString()}
                                            </td>
                                            <td className="p-4 text-red-600 dark:text-red-400 font-medium whitespace-nowrap">
                                                {ticket.slaDeadline ? new Date(ticket.slaDeadline).toLocaleString() : 'N/A'}
                                            </td>
                                            <td className="p-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border ${ticket.status === 'resolved'
                                                    ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
                                                    : ticket.status === 'approval'
                                                        ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800'
                                                        : 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800'
                                                    }`}>
                                                    {ticket.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="py-12 text-center flex flex-col items-center justify-center">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-medium text-[var(--text-primary)]">No Details Available</h3>
                            <p className="text-[var(--text-muted)] mt-1 max-w-sm">No ticket tracking data could be located for this incident.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
