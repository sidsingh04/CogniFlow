import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance, { setAccessToken } from '../../utils/axiosInstance';
import KBSuggestionsModal from './KBSuggestionsModal';
import ClosingReviewModal from './ClosingReviewModal';

interface AgentTabsProps {
    agent: any;
    tickets: any[];
    onTicketClick: (ticket: any) => void;
    historyRefreshId?: number;
}

export default function AgentTabs({ agent, tickets, onTicketClick, historyRefreshId }: AgentTabsProps) {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'pending' | 'activity'>('pending');
    const [kbTicket, setKbTicket] = useState<any>(null);
    const [reviewTicket, setReviewTicket] = useState<any>(null);

    // Pending Tickets search (client-side)
    const [searchQuery, setSearchQuery] = useState('');

    // History Tickets search (server-side via regex)
    const [historySearchQuery, setHistorySearchQuery] = useState('');
    const [debouncedHistorySearch, setDebouncedHistorySearch] = useState('');

    // Pagination State for History
    const [historyPage, setHistoryPage] = useState(1);
    const [totalHistoryPages, setTotalHistoryPages] = useState(1);
    const [paginatedHistory, setPaginatedHistory] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleSignOut = async () => {
        if (agent?.status === 'Break') {
            alert('You cannot sign out while on break.');
            return;
        }

        try {
            await axiosInstance.post('/api/agent/update-status', {
                agentId: agent?.agentId,
                status: 'Offline'
            });
            try {
                await axiosInstance.post('/api/login/logout');
            } catch (e) {
                console.error("Logout API call failed", e);
            }
            setAccessToken(null);
            sessionStorage.clear();
            navigate('/');
        } catch (e) {
            console.error("Signout update failed", e);
        }
    };

    // Debounce history search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedHistorySearch(historySearchQuery);
            setHistoryPage(1); // Reset page on new search
        }, 300);
        return () => clearTimeout(timer);
    }, [historySearchQuery]);

    // Fetch Paginated History
    useEffect(() => {
        if (!agent?.agentId) return;

        const fetchPaginatedHistory = async () => {
            setIsLoadingHistory(true);
            try {
                const res = await axiosInstance.get('/api/ticket/get-paginated-history', {
                    params: {
                        agentId: agent.agentId,
                        page: historyPage,
                        limit: 5,
                        search: debouncedHistorySearch
                    }
                });
                if (res.data.success) {
                    setPaginatedHistory(res.data.tickets);
                    setTotalHistoryPages(res.data.pagination.totalPages || 1);
                }
            } catch (error) {
                console.error("Failed to fetch history page", error);
            } finally {
                setIsLoadingHistory(false);
            }
        };

        fetchPaginatedHistory();
    }, [agent?.agentId, historyPage, debouncedHistorySearch, historyRefreshId]);

    const pendingTickets = useMemo(() => {
        return tickets?.filter(t => t.status === 'pending') || [];
    }, [tickets]);

    const approvalTickets = useMemo(() => {
        return (tickets?.filter(t => t.status === 'approval') || []).sort((a, b) =>
            new Date(b.approvalDate).getTime() - new Date(a.approvalDate).getTime()
        );
    }, [tickets]);

    const resolvedTickets = useMemo(() => {
        return tickets?.filter(t => t.status === 'resolved') || [];
    }, [tickets]);

    const filteredPending = useMemo(() => {
        if (!searchQuery) return pendingTickets;
        const lowerQuery = searchQuery.toLowerCase();
        return pendingTickets.filter(
            t => t.issueId.toLowerCase().includes(lowerQuery) || t.code?.toLowerCase().includes(lowerQuery)
        );
    }, [pendingTickets, searchQuery]);

    const renderTicketCard = (ticket: any, type: 'pending' | 'approval' | 'history') => {
        const isPending = type === 'pending';
        const statusColorClass = isPending ? 'bg-blue-100 text-blue-700' :
            (ticket.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700');

        return (
            <div
                key={ticket.issueId}
                onClick={() => onTicketClick(ticket)}
                className="bg-[var(--bg-card)] p-4 rounded-lg border border-[var(--border-primary)] flex flex-col gap-2 cursor-pointer transition-all hover:-translate-y-0.5 hover:bg-[var(--bg-card-hover)] hover:shadow-[var(--shadow-md)]"
            >
                <div className="flex justify-between items-center">
                    <span className="font-mono font-semibold text-gray-500">{ticket.issueId}</span>
                    <span className={`text-[0.75rem] px-2.5 py-1 rounded-md uppercase font-semibold capitalize ${statusColorClass}`}>
                        {ticket.status}
                    </span>
                </div>
                <div className="font-medium text-[var(--text-primary)]">{ticket.code || 'No Subject'}</div>
                <div className="flex justify-between text-[0.85rem] text-gray-500 mt-2">
                    <span>{new Date(ticket.issueDate).toLocaleDateString()}</span>
                    {isPending && (
                        <div className="flex gap-2">
                            <button
                                onClick={(e) => { e.stopPropagation(); setKbTicket(ticket); }}
                                className="px-3 py-1 bg-transparent border border-indigo-400 text-indigo-500 rounded-md text-[0.85rem] cursor-pointer transition-colors hover:bg-indigo-500 hover:text-white flex items-center gap-1"
                                title="Knowledge Base Suggestions"
                            >
                                📚 KB
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onTicketClick(ticket); }}
                                className="px-3 py-1 bg-transparent border border-[var(--accent-primary)] text-[var(--accent-primary)] rounded-md text-[0.85rem] cursor-pointer transition-colors hover:bg-[var(--accent-primary)] hover:text-[var(--text-primary)]"
                            >
                                View Details
                            </button>
                        </div>
                    )}
                    {type === 'history' && ticket.status === 'resolved' && !ticket.reviewGiven && (
                        <div className="flex gap-2">
                            <button
                                onClick={(e) => { e.stopPropagation(); setReviewTicket(ticket); }}
                                className="px-3 py-1 bg-transparent border border-emerald-500 text-emerald-600 rounded-md text-[0.85rem] cursor-pointer transition-colors hover:bg-emerald-500 hover:text-white flex items-center gap-1 font-medium"
                                title="Write a closing review to save as a KB article"
                            >
                                ✍️ Write Review
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onTicketClick(ticket); }}
                                className="px-3 py-1 bg-transparent border border-[var(--accent-primary)] text-[var(--accent-primary)] rounded-md text-[0.85rem] cursor-pointer transition-colors hover:bg-[var(--accent-primary)] hover:text-[var(--text-primary)]"
                            >
                                View Details
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="flex-1 flex gap-6 overflow-hidden h-full">

            {/* Left Sidebar Navigation */}
            <div className="w-[220px] shrink-0 flex flex-col justify-between border-r border-[#e5e7eb] px-4 h-full pb-4">
                <div className="flex flex-col gap-2">
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all font-medium text-sm cursor-pointer ${activeTab === 'pending'
                            ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] font-bold'
                            : 'text-[var(--text-secondary)] hover:bg-gray-100 hover:text-[var(--text-primary)]'
                            }`}
                    >
                        <span>Pending Tickets</span>
                        <span className={`text-xs py-0.5 px-2 rounded-full font-bold ${activeTab === 'pending' ? 'bg-[var(--accent-primary)] text-white' : 'bg-gray-200 text-gray-600'}`}>
                            {pendingTickets.length}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveTab('activity')}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all font-medium text-sm cursor-pointer ${activeTab === 'activity'
                            ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] font-bold'
                            : 'text-[var(--text-secondary)] hover:bg-gray-100 hover:text-[var(--text-primary)]'
                            }`}
                    >
                        <span>Activity & History</span>
                    </button>
                </div>

                {/* Bottom Sign Out Container */}
                <div className="mt-auto flex justify-center w-full">
                    <button
                        onClick={handleSignOut}
                        className="w-[90%] flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 border border-red-200 rounded-xl cursor-pointer text-sm font-semibold transition-all hover:bg-red-600 hover:text-white hover:border-red-600 shadow-sm"
                    >
                        <span>Sign Out</span>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto pr-2 pb-4 flex flex-col gap-6">

                {activeTab === 'pending' && (
                    <div className="flex flex-col gap-4">
                        {/* Pending search bar */}
                        <div className="sticky top-0 z-10 bg-[var(--bg-primary)] pb-4 -mt-2">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search pending tickets by ID, subject"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full py-2.5 px-4 pl-10 border border-[var(--border-secondary)] rounded-lg text-[0.9rem] outline-none transition-colors focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/10 bg-[var(--bg-card)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] shadow-sm"
                                />
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-[1.1rem]">
                                    🔍
                                </span>
                            </div>
                        </div>

                        {filteredPending.length > 0 ? (
                            filteredPending.map(t => renderTicketCard(t, 'pending'))
                        ) : (
                            <div className="text-center p-8 text-[var(--text-muted)] italic bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] shadow-sm">
                                {searchQuery ? 'No matching tickets found' : 'No pending tickets available'}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'activity' && (
                    <div className="flex flex-col gap-6">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-[var(--bg-card)] p-5 rounded-xl shadow-sm border border-[var(--border-primary)] flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl bg-emerald-100 text-emerald-500">✓</div>
                                <div className="flex flex-col">
                                    <span className="text-xl font-bold text-[var(--text-primary)]">{resolvedTickets.length}</span>
                                    <span className="text-[0.8rem] text-[var(--text-secondary)]">Resolved</span>
                                </div>
                            </div>
                            <div className="bg-[var(--bg-card)] p-5 rounded-xl shadow-sm border border-[var(--border-primary)] flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl bg-orange-50 text-orange-500">⏳</div>
                                <div className="flex flex-col">
                                    <span className="text-xl font-bold text-[var(--text-primary)]">{pendingTickets.length}</span>
                                    <span className="text-[0.8rem] text-[var(--text-secondary)]">Pending</span>
                                </div>
                            </div>
                            <div className="bg-[var(--bg-card)] p-5 rounded-xl shadow-sm border border-[var(--border-primary)] flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl bg-blue-50 text-blue-500">📝</div>
                                <div className="flex flex-col">
                                    <span className="text-xl font-bold text-[var(--text-primary)]">{approvalTickets.length}</span>
                                    <span className="text-[0.8rem] text-[var(--text-secondary)]">Approval</span>
                                </div>
                            </div>
                        </div>

                        {/* Removed separate approval tickets list to allow them to flow organically into the paginated history list */}

                        <div className="mt-2 pb-2 border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider font-bold flex justify-between items-center">
                            <span>Ticket History</span>
                        </div>

                        {/* History search bar */}
                        <div className="sticky top-0 z-10 bg-[var(--bg-primary)] pb-2 -mt-2">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search history by ID, subject, or status"
                                    value={historySearchQuery}
                                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                                    className="w-full py-2.5 px-4 pl-10 border border-[var(--border-secondary)] rounded-lg text-[0.9rem] outline-none transition-colors focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/10 bg-[var(--bg-card)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] shadow-sm"
                                />
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-[1.1rem]">
                                    🔍
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 min-h-[300px]">
                            {isLoadingHistory ? (
                                <div className="text-center p-8 text-[var(--text-muted)] italic bg-[var(--bg-card)] rounded-lg border border-[var(--border-secondary)] shadow-sm flex-1 flex items-center justify-center">Loading history...</div>
                            ) : paginatedHistory.length > 0 ? (
                                paginatedHistory.map(t => renderTicketCard(t, 'history'))
                            ) : (
                                <div className="text-center p-8 text-[var(--text-muted)] italic bg-[var(--bg-card)] rounded-lg border border-[var(--border-secondary)] shadow-sm flex-1 flex items-center justify-center">
                                    {debouncedHistorySearch ? 'No history matched your search' : 'No history available'}
                                </div>
                            )}
                        </div>

                        {/* Pagination Controls */}
                        {!isLoadingHistory && totalHistoryPages > 1 && (
                            <div className="flex justify-between items-center px-4 py-3 bg-[var(--bg-card)] border border-[var(--border-secondary)] rounded-lg shadow-[var(--shadow-sm)]">
                                <button
                                    disabled={historyPage === 1}
                                    onClick={() => setHistoryPage(prev => prev - 1)}
                                    className="px-4 py-2 text-sm font-medium bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded-md text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] disabled:opacity-50 cursor-pointer transition-colors"
                                >
                                    Previous
                                </button>
                                <span className="text-sm font-medium text-[var(--text-secondary)]">
                                    Page {historyPage} of {totalHistoryPages || 1}
                                </span>
                                <button
                                    disabled={historyPage >= totalHistoryPages}
                                    onClick={() => setHistoryPage(prev => prev + 1)}
                                    className="px-4 py-2 text-sm font-medium bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded-md text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] disabled:opacity-50 cursor-pointer transition-colors"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* KB Suggestions Modal */}
            <KBSuggestionsModal
                isOpen={!!kbTicket}
                onClose={() => setKbTicket(null)}
                ticket={kbTicket}
            />

            {/* Closing Review Modal */}
            <ClosingReviewModal
                isOpen={!!reviewTicket}
                onClose={() => setReviewTicket(null)}
                ticket={reviewTicket}
                onSuccess={() => {
                    // Update paginated state locally so the button disappears instantly
                    setPaginatedHistory(prev => prev.map(t => 
                        t.issueId === reviewTicket.issueId ? { ...t, reviewGiven: true } : t
                    ));
                }}
            />
        </div>
    );
}
