import React, { useState, useEffect, useRef } from 'react';
import axiosInstance from '../../utils/axiosInstance';

interface CreateTicketModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function CreateTicketModal({ isOpen, onClose, onSuccess }: CreateTicketModalProps) {
    const [typeIssue, setTypeIssue] = useState('');
    const [description, setDescription] = useState('');
    const [agentSearch, setAgentSearch] = useState('');
    const [selectedAgentId, setSelectedAgentId] = useState('');
    const [agentResults, setAgentResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Close on escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Handle Agent Search
    useEffect(() => {
        if (!agentSearch) {
            setAgentResults([]);
            return;
        }

        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

        searchTimeoutRef.current = setTimeout(async () => {
            setIsSearching(true);
            try {
                const res = await axiosInstance.get('/api/agent/getAllAgents');
                if (res.data.success) {
                    const filtered = res.data.agents.filter((a: any) =>
                    (a.agentId.toLowerCase().includes(agentSearch.toLowerCase()) ||
                        a.name.toLowerCase().includes(agentSearch.toLowerCase()))
                    );
                    setAgentResults(filtered);
                }
            } catch (err) {
                console.error("Agent search failed:", err);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        };
    }, [agentSearch]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!typeIssue || !description || !selectedAgentId) {
            alert('Please fill all required fields and select an agent.');
            return;
        }

        setIsSubmitting(true);

        try {
            const ticketId = `TKT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

            const ticketData = {
                issueId: ticketId,
                code: typeIssue,
                description: description,
                callDuration: null,
                agentId: selectedAgentId,
                status: 'pending',
                issueDate: new Date().toUTCString(),
                resolvedDate: null
            };

            // 1. Create ticket
            await axiosInstance.post('/api/ticket/create', ticketData);

            // 2. Update agent status to busy
            const agentRes = await axiosInstance.get(`/api/agent/get-agent?agentId=${selectedAgentId}`);
            if (agentRes.data.success) {
                const agent = agentRes.data.agent;
                agent.totalPending += 1;
                agent.status = 'Busy';
                await axiosInstance.put('/api/agent/update', agent);
            }

            // Reset form and close
            setTypeIssue('');
            setDescription('');
            setAgentSearch('');
            setSelectedAgentId('');
            onSuccess();
            onClose();

        } catch (error) {
            console.error('Error creating ticket:', error);
            alert('Failed to create ticket. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 transition-opacity duration-300">
            <div className="bg-[var(--bg-card)] rounded-xl shadow-[var(--shadow-lg)] w-full max-w-lg border border-[var(--border-secondary)] overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="px-6 py-4 border-b border-[var(--border-secondary)] flex justify-between items-center bg-[var(--bg-tertiary)] shrink-0">
                    <h2 className="text-xl font-bold text-[var(--text-primary)] m-0">Create New Ticket</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 bg-transparent border-none text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body Form */}
                <form id="createTicketForm" onSubmit={handleSubmit} className="p-6 flex flex-col gap-5 overflow-y-auto">

                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-[var(--text-secondary)]">Type-Issue <span className="text-red-500">*</span></label>
                        <select
                            value={typeIssue}
                            onChange={e => setTypeIssue(e.target.value)}
                            required
                            className="p-3 border border-[var(--border-primary)] rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20 transition-all font-medium"
                        >
                            <option value="">Select issue type</option>
                            <option value="technical">Technical Issue</option>
                            <option value="billing">Billing Issue</option>
                            <option value="account">Account Issue</option>
                            <option value="service">Service Issue</option>
                            <option value="other">Other</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-[var(--text-secondary)]">Description <span className="text-red-500">*</span></label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={4}
                            required
                            placeholder="Provide detailed information about the issue..."
                            className="p-3 border border-[var(--border-primary)] rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20 transition-all font-medium resize-y"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5 relative">
                        <label className="text-sm font-semibold text-[var(--text-secondary)]">Agent Assign <span className="text-red-500">*</span></label>
                        <div className="group relative">
                            <input
                                type="text"
                                value={agentSearch}
                                onChange={e => {
                                    setAgentSearch(e.target.value);
                                    if (e.target.value !== selectedAgentId) setSelectedAgentId('');
                                }}
                                placeholder="Search by name or ID..."
                                className={`w-full p-3 border ${selectedAgentId ? 'border-emerald-500 bg-emerald-50/10' : 'border-[var(--border-primary)]'} rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20 transition-all font-medium`}
                            />

                            {/* Autocomplete Dropdown */}
                            {agentSearch && !selectedAgentId && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--bg-card)] border border-[var(--border-secondary)] rounded-lg shadow-lg z-10 max-h-[200px] overflow-y-auto">
                                    {isSearching ? (
                                        <div className="p-3 text-center text-sm text-[var(--text-muted)] italic">Searching...</div>
                                    ) : agentResults.length > 0 ? (
                                        agentResults.map(a => (
                                            <div
                                                key={a.agentId}
                                                onClick={() => {
                                                    setSelectedAgentId(a.agentId);
                                                    setAgentSearch(a.name);
                                                }}
                                                className="p-3 border-b border-[var(--border-secondary)] last:border-0 hover:bg-[var(--bg-secondary)] cursor-pointer flex justify-between items-center transition-colors"
                                            >
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-sm text-[var(--text-primary)]">{a.name}</span>
                                                    <span className="text-xs text-[var(--text-muted)] font-mono">{a.agentId}</span>
                                                </div>
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${a.status === 'Available' ? 'bg-emerald-100 text-emerald-700' :
                                                    a.status === 'Busy' ? 'bg-rose-100 text-rose-700' :
                                                        a.status === 'On Break' ? 'bg-amber-100 text-amber-700' :
                                                            'bg-gray-100 text-gray-700'
                                                    }`}>
                                                    {a.status}
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-3 text-center text-sm text-[var(--text-muted)] italic">No agents found</div>
                                    )}
                                </div>
                            )}
                            {selectedAgentId && (
                                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-[var(--text-secondary)]">Status</label>
                        <input
                            type="text"
                            disabled
                            value="pending"
                            className="p-3 border border-[var(--border-primary)] rounded-lg bg-[var(--bg-secondary)] text-[var(--text-muted)] opacity-70 cursor-not-allowed font-semibold uppercase"
                        />
                    </div>
                </form>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-[var(--border-secondary)] bg-[var(--bg-tertiary)] flex justify-end gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-card)] text-[var(--text-primary)] font-semibold text-sm cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="createTicketForm"
                        disabled={isSubmitting || !selectedAgentId}
                        className="px-5 py-2.5 rounded-lg border-none bg-[var(--accent-primary)] text-white font-semibold text-sm cursor-pointer hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                        {isSubmitting ? (
                            <span>Submitting...</span>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v14M5 12h14" />
                                </svg>
                                Raise Ticket
                            </>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
}
