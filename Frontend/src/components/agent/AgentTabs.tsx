import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance, { setAccessToken } from '../../utils/axiosInstance';
import KBSuggestionsModal from './KBSuggestionsModal';
import ClosingReviewModal from './ClosingReviewModal';
import PendingTicketsFilterModal from './PendingTicketsFilterModal';
import HistoryFilterModal from './HistoryFilterModal';

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

    // Pending Tickets search/filter state (client-side)
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [pendingFilters, setPendingFilters] = useState({
        searchQuery: '',
        startDate: '',
        endDate: ''
    });


    const [isHistoryFilterModalOpen, setIsHistoryFilterModalOpen] = useState(false);
    const [historyFilters, setHistoryFilters] = useState({
        issueId: '',
        code: '',
        status: 'All',
        issueDate: '',
        resolvedDate: ''
    });

    // Pagination State for History
    const [historyPage, setHistoryPage] = useState(1);
    const [totalHistoryPages, setTotalHistoryPages] = useState(1);
    const [paginatedHistory, setPaginatedHistory] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

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
                        ...historyFilters
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
    }, [agent?.agentId, historyPage, historyFilters, historyRefreshId]);

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
        let result = pendingTickets;
        const { searchQuery, startDate, endDate } = pendingFilters;
        
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(
                t => t.issueId.toLowerCase().includes(lowerQuery) || t.code?.toLowerCase().includes(lowerQuery)
            );
        }

        if (startDate) {
            const start = new Date(startDate).setHours(0, 0, 0, 0);
            result = result.filter(t => new Date(t.issueDate).getTime() >= start);
        }

        if (endDate) {
            const end = new Date(endDate).setHours(23, 59, 59, 999);
            result = result.filter(t => new Date(t.issueDate).getTime() <= end);
        }

        return result;
    }, [pendingTickets, pendingFilters]);



    return (
        <div className="flex-1 flex gap-6 overflow-hidden h-full">

            {/* Left Sidebar Navigation */}
            <div className="w-[220px] shrink-0 flex flex-col justify-between border-r border-[#e5e7eb] px-4 h-full pb-4">
                <div className="flex flex-col gap-2">
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all font-medium text-sm cursor-pointer ${activeTab === 'pending'
                            ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] font-bold'
                            : 'text-[var(--text-secondary)] hover:bg-gray-100 hover:text-gray-900'
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
                            : 'text-[var(--text-secondary)] hover:bg-gray-100 hover:text-gray-900'
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
                        {/* Pending Toolbar with Filter Button */}
                        <div className="sticky top-0 z-10 bg-[var(--bg-primary)] pb-4 -mt-2">
                            <div className="flex justify-between items-center bg-[var(--bg-card)] p-3 border border-[var(--border-secondary)] rounded-lg shadow-sm">
                                <div className="text-[var(--text-secondary)] text-sm font-medium flex items-center gap-2">
                                    <span className="bg-orange-100 text-orange-700 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">{filteredPending.length}</span>
                                    Tickets Found
                                    {(pendingFilters.searchQuery || pendingFilters.startDate || pendingFilters.endDate) && (
                                        <span className="ml-2 text-xs text-indigo-500 font-semibold italic bg-indigo-50 px-2 py-0.5 rounded-full">(Filters Applied)</span>
                                    )}
                                </div>
                                <button
                                    onClick={() => setIsFilterModalOpen(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg text-sm font-semibold shadow-sm hover:bg-indigo-600 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                    </svg>
                                    Filter Tickets
                                </button>
                            </div>
                        </div>

                        {filteredPending.length > 0 ? (
                            <div className="overflow-x-auto rounded-lg border border-[var(--border-secondary)] shadow-sm bg-[var(--bg-card)]">
                                <table className="w-full text-left border-collapse table-fixed">
                                    <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-xs uppercase tracking-wider font-semibold border-b border-[var(--border-secondary)]">
                                        <tr>
                                            <th className="px-4 py-3 whitespace-nowrap w-[20%]">Ticket ID</th>
                                            <th className="px-4 py-3 whitespace-nowrap w-[20%]">Subject</th>
                                            <th className="px-4 py-3 whitespace-nowrap w-[20%]">Issue Date</th>
                                            <th className="px-4 py-3 whitespace-nowrap w-[20%]">Status</th>
                                            <th className="px-4 py-3 text-right whitespace-nowrap w-[20%]">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--border-secondary)]">
                                        {filteredPending.map(ticket => (
                                            <tr key={ticket.issueId} onClick={() => onTicketClick(ticket)} className="hover:bg-[var(--bg-card-hover)] cursor-pointer transition-colors group">
                                                <td className="px-4 py-3 font-mono text-sm text-[var(--text-primary)] truncate">{ticket.issueId}</td>
                                                <td className="px-4 py-3 text-sm font-medium text-[var(--text-primary)] truncate" title={ticket.code || 'No Subject'}>{ticket.code || 'No Subject'}</td>
                                                <td className="px-4 py-3 text-sm text-[var(--text-secondary)] truncate">{new Date(ticket.issueDate).toLocaleDateString()}</td>
                                                <td className="px-4 py-3 text-sm truncate">
                                                    <span className="text-[0.75rem] px-2.5 py-1 rounded-md uppercase font-semibold capitalize bg-blue-100 text-blue-700">
                                                        {ticket.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex justify-end gap-2 transition-opacity">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setKbTicket(ticket); }}
                                                            className="p-1.5 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-md text-lg cursor-pointer transition-colors hover:bg-indigo-500 hover:text-white flex items-center justify-center shadow-sm"
                                                            title="KB Search"
                                                        >
                                                            📚
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onTicketClick(ticket); }}
                                                            className="p-1.5 bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 text-[var(--accent-primary)] rounded-md text-lg cursor-pointer transition-colors hover:bg-[var(--accent-primary)] hover:text-white flex items-center justify-center shadow-sm"
                                                            title="View Details"
                                                        >
                                                            👁️
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center p-8 text-[var(--text-muted)] italic bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] shadow-sm">
                                {(pendingFilters.searchQuery || pendingFilters.startDate || pendingFilters.endDate) ? 'No matching tickets found' : 'No pending tickets available'}
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

                        {/* History search bar & filter button */}
                        <div className="flex justify-start pb-4 pt-2">
                            <button
                                onClick={() => setIsHistoryFilterModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg text-sm font-semibold shadow-sm hover:bg-indigo-600 transition-colors whitespace-nowrap"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                </svg>
                                Filter History
                            </button>
                        </div>

                        <div className="flex flex-col gap-3 min-h-[300px]">
                            {isLoadingHistory ? (
                                <div className="text-center p-8 text-[var(--text-muted)] italic bg-[var(--bg-card)] rounded-lg border border-[var(--border-secondary)] shadow-sm flex-1 flex items-center justify-center">Loading history...</div>
                            ) : paginatedHistory.length > 0 ? (
                                <div className="overflow-x-auto rounded-lg border border-[var(--border-secondary)] shadow-sm bg-[var(--bg-card)]">
                                    <table className="w-full text-left border-collapse table-fixed">
                                        <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-xs uppercase tracking-wider font-semibold border-b border-[var(--border-secondary)]">
                                            <tr>
                                                <th className="px-4 py-3 whitespace-nowrap w-1/6">Ticket ID</th>
                                                <th className="px-4 py-3 whitespace-nowrap w-1/6">Subject</th>
                                                <th className="px-4 py-3 whitespace-nowrap w-1/6">Issue Date</th>
                                                <th className="px-4 py-3 whitespace-nowrap w-1/6">Resolved Date</th>
                                                <th className="px-4 py-3 whitespace-nowrap w-1/6">Status</th>
                                                <th className="px-4 py-3 text-right whitespace-nowrap w-1/6">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--border-secondary)]">
                                            {paginatedHistory.map(ticket => {
                                                const statusColorClass = ticket.status === 'resolved' ? 'bg-green-100 text-green-700' : (ticket.status === 'pending' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700');
                                                return (
                                                    <tr key={ticket.issueId} onClick={() => onTicketClick(ticket)} className="hover:bg-[var(--bg-card-hover)] cursor-pointer transition-colors group">
                                                        <td className="px-4 py-3 font-mono text-sm text-[var(--text-primary)] truncate">{ticket.issueId}</td>
                                                        <td className="px-4 py-3 text-sm font-medium text-[var(--text-primary)] truncate" title={ticket.code || 'No Subject'}>{ticket.code || 'No Subject'}</td>
                                                        <td className="px-4 py-3 text-sm text-[var(--text-secondary)] truncate">{new Date(ticket.issueDate).toLocaleDateString()}</td>
                                                        <td className="px-4 py-3 text-sm text-[var(--text-secondary)] truncate">{ticket.resolvedDate ? new Date(ticket.resolvedDate).toLocaleDateString() : '-'}</td>
                                                        <td className="px-4 py-3 text-sm truncate">
                                                            <span className={`text-[0.75rem] px-2.5 py-1 rounded-md uppercase font-semibold capitalize ${statusColorClass}`}>
                                                                {ticket.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="flex justify-end gap-2 transition-opacity">
                                                                {ticket.status === 'resolved' && !ticket.reviewGiven && (
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); setReviewTicket(ticket); }}
                                                                        className="p-1.5 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-md text-lg cursor-pointer transition-colors hover:bg-emerald-500 hover:text-white flex items-center justify-center shadow-sm"
                                                                        title="Write a closing review"
                                                                    >
                                                                        ✍️
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); onTicketClick(ticket); }}
                                                                    className="p-1.5 bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 text-[var(--accent-primary)] rounded-md text-lg cursor-pointer transition-colors hover:bg-[var(--accent-primary)] hover:text-white flex items-center justify-center shadow-sm"
                                                                    title="View Details"
                                                                >
                                                                    👁️
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center p-8 text-[var(--text-muted)] italic bg-[var(--bg-card)] rounded-lg border border-[var(--border-secondary)] shadow-sm flex-1 flex items-center justify-center">
                                    {Object.values(historyFilters).some(v => v && v !== 'All') ? 'No history matched your search' : 'No history available'}
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

            {/* Pending Tickets Filter Modal */}
            <PendingTicketsFilterModal
                isOpen={isFilterModalOpen}
                onClose={() => setIsFilterModalOpen(false)}
                onApply={(filters) => setPendingFilters(filters)}
                initialFilters={pendingFilters}
            />

            {/* History Tickets Filter Modal */}
            <HistoryFilterModal
                isOpen={isHistoryFilterModalOpen}
                onClose={() => setIsHistoryFilterModalOpen(false)}
                onApply={(filters) => {
                    setHistoryFilters(filters);
                    setHistoryPage(1);
                }}
                initialFilters={historyFilters}
            />
        </div>
    );
}
