import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CreateTicketModal from './CreateTicketModal';
import SupervisorTicketDetailsModal from './SupervisorTicketDetailsModal';
import socket from '../../services/socket';

interface Ticket {
    issueId: string;
    code: string;
    description: string;
    status: string;
    agentId: string;
    issueDate: string;
    approvalDate?: string;
    resolvedDate?: string;
    callDuration?: number;
    remarks?: string;
}

// Custom Hook for Debouncing Values
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

export default function TicketsTab() {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [totalResults, setTotalResults] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [isFiltering, setIsFiltering] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

    // Attachment Viewer State
    const [attachmentModalOpen, setAttachmentModalOpen] = useState(false);
    const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
    const [attachmentType, setAttachmentType] = useState<string | null>(null);
    const [isFetchingAttachment, setIsFetchingAttachment] = useState(false);
    const [attachmentError, setAttachmentError] = useState<string | null>(null);

    // Search and Sort State
    const [searchAgentId, setSearchAgentId] = useState('');
    const [searchCode, setSearchCode] = useState('');
    const debouncedAgentId = useDebounce(searchAgentId, 400);
    const debouncedCode = useDebounce(searchCode, 400);

    const [filterStatus, setFilterStatus] = useState('All');
    const [filterIssueDate, setFilterIssueDate] = useState('');
    const [filterResolvedDate, setFilterResolvedDate] = useState('');

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const todayStr = new Date().toISOString().split('T')[0];

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedAgentId, debouncedCode, filterStatus, filterIssueDate, filterResolvedDate]);

    const fetchFilteredTickets = async (page = currentPage) => {
        setIsFiltering(true);
        try {
            const params: Record<string, string | number> = {
                page,
                limit: itemsPerPage
            };

            if (debouncedAgentId.trim()) params.agentId = debouncedAgentId.trim();
            if (debouncedCode.trim()) params.code = debouncedCode.trim();
            if (filterStatus !== 'All') params.status = filterStatus;
            if (filterIssueDate) params.issueDate = filterIssueDate;
            if (filterResolvedDate) params.resolvedDate = filterResolvedDate;

            const res = await axios.get('http://localhost:3000/api/ticket/get-filtered', { params });
            if (res.data.success) {
                setTickets(res.data.tickets);
                setTotalResults(res.data.pagination.total);
                setTotalPages(res.data.pagination.totalPages);
            }
        } catch (error) {
            console.error("Error fetching tickets:", error);
        } finally {
            setIsFiltering(false);
            setIsInitialLoading(false);
        }
    };

    const handleViewAttachment = async (e: React.MouseEvent, ticketId: string) => {
        e.stopPropagation();
        setAttachmentError(null);
        setAttachmentUrl(null);
        setAttachmentType(null);
        setAttachmentModalOpen(true);
        setIsFetchingAttachment(true);

        try {
            const res = await axios.get(`http://localhost:3000/api/attachments/ticket/${ticketId}`);
            if (res.data.success) {
                setAttachmentUrl(res.data.url);
                setAttachmentType(res.data.fileType);
            }
        } catch (error: any) {
            console.error("Error fetching attachment:", error);
            if (error.response?.status === 404) {
                setAttachmentError("No attachment found for this ticket.");
            } else {
                setAttachmentError("Failed to load attachment. Please try again.");
            }
        } finally {
            setIsFetchingAttachment(false);
        }
    };

    // Fetch tickets whenever filters or page changes
    useEffect(() => {
        fetchFilteredTickets(currentPage);
    }, [debouncedAgentId, debouncedCode, filterStatus, filterIssueDate, filterResolvedDate, currentPage]);

    useEffect(() => {
        socket.connect();
        const refreshTickets = () => {
            fetchFilteredTickets(currentPage);
        };

        socket.on("ticketAssigned", refreshTickets);
        socket.on("ticketApprovalSent", refreshTickets);
        socket.on("ticketResolved", refreshTickets);
        socket.on("ticketRejected", refreshTickets);
        socket.on("ticketUpdated", refreshTickets);

        return () => {
            socket.off("ticketAssigned", refreshTickets);
            socket.off("ticketApprovalSent", refreshTickets);
            socket.off("ticketResolved", refreshTickets);
            socket.off("ticketRejected", refreshTickets);
            socket.off("ticketUpdated", refreshTickets);
        };
    }, [currentPage, debouncedAgentId, debouncedCode, filterStatus, filterIssueDate, filterResolvedDate]);

    const StatusBadge = ({ status }: { status: string }) => {
        const config: Record<string, { bg: string, text: string, dot: string }> = {
            pending: { bg: 'bg-[var(--status-pending-bg)]', text: 'text-[var(--status-pending-color)]', dot: 'bg-orange-400' },
            approval: { bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-400' },
            resolved: { bg: 'bg-[var(--status-resolved-bg)]', text: 'text-[var(--status-resolved-color)]', dot: 'bg-emerald-400' }
        };

        const style = config[status.toLowerCase()] || { bg: 'bg-gray-100', text: 'text-gray-800', dot: 'bg-gray-400' };

        return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${style.bg} ${style.text} text-xs font-semibold rounded uppercase tracking-wider border border-current/20`}>
                <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`}></span>
                {status}
            </span>
        );
    };

    if (isInitialLoading) {
        return <div className="p-8 text-center text-[var(--text-muted)] italic flex-1 flex items-center justify-center">Loading tickets...</div>;
    }

    return (
        <div className="px-4 py-2 h-full flex flex-col gap-3">

            {/* Top Bar with Create Button */}
            <div className="flex justify-start items-center gap-4">
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] transition-colors px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 border-none cursor-pointer shadow-sm"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v14M5 12h14" />
                    </svg>
                    Create Ticket
                </button>
                <h2 className="text-lg font-bold text-[var(--text-primary)] m-0">All System Tickets</h2>
            </div>

            {/* Control Panel */}
            <div className="bg-[var(--bg-card)] rounded-xl shadow-[var(--shadow-sm)] border border-[var(--border-secondary)] overflow-hidden shrink-0">
                <div className="px-4 py-2 bg-[var(--bg-tertiary)] border-b border-[var(--border-secondary)] flex justify-between items-center">
                    <h2 className="text-sm font-bold text-[var(--text-primary)] m-0 flex items-center gap-2">
                        <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                        Filter Controls
                    </h2>
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">
                        {totalResults} result{totalResults !== 1 ? 's' : ''}
                    </span>
                </div>

                <div className="px-4 py-3 flex flex-wrap md:flex-nowrap gap-3 items-end">
                    {/* Text Search Group */}
                    <div className="flex flex-col gap-1.5 flex-[1.5] min-w-[150px]">
                        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">Search Agent ID</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="w-3.5 h-3.5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchAgentId}
                                onChange={(e) => setSearchAgentId(e.target.value)}
                                className="w-full pl-8 pr-3 py-2 border border-[var(--border-secondary)] rounded-md bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all text-xs"
                            />
                            {searchAgentId && (
                                <button onClick={() => setSearchAgentId('')} className="absolute inset-y-0 right-0 pr-2 flex items-center text-[var(--text-muted)] hover:text-red-500 transition-colors">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5 flex-[2] min-w-[150px]">
                        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">Search Topic</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="w-3.5 h-3.5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                            </div>
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchCode}
                                onChange={(e) => setSearchCode(e.target.value)}
                                className="w-full pl-8 pr-3 py-2 border border-[var(--border-secondary)] rounded-md bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all text-xs"
                            />
                            {searchCode && (
                                <button onClick={() => setSearchCode('')} className="absolute inset-y-0 right-0 pr-2 flex items-center text-[var(--text-muted)] hover:text-red-500 transition-colors">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Status Dropdown */}
                    <div className="flex flex-col gap-1.5 flex-[1.5] min-w-[120px]">
                        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">Status</label>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="w-full px-3 py-2 border border-[var(--border-secondary)] rounded-md bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all text-xs appearance-none cursor-pointer"
                            style={{ backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>')`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.2em 1.2em' }}
                        >
                            <option value="All">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="approval">Approval</option>
                            <option value="resolved">Resolved</option>
                        </select>
                    </div>

                    {/* Date Pickers */}
                    <div className="flex flex-col gap-1.5 flex-[1] min-w-[130px] max-w-[180px]">
                        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">Issue Date</label>
                        <div className="relative">
                            <input
                                type="date"
                                max={todayStr}
                                value={filterIssueDate}
                                onChange={(e) => setFilterIssueDate(e.target.value)}
                                className={`w-full px-3 py-2 border border-[var(--border-secondary)] rounded-md bg-[var(--bg-primary)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all text-xs cursor-pointer ${!filterIssueDate ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}
                            />
                            {filterIssueDate && (
                                <button onClick={() => setFilterIssueDate('')} className="absolute inset-y-0 right-7 pr-1 flex items-center text-[var(--text-muted)] hover:text-red-500 transition-colors z-10 bg-[var(--bg-primary)]">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5 flex-[1] min-w-[130px] max-w-[180px]">
                        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">Resolved Date</label>
                        <div className="relative">
                            <input
                                type="date"
                                max={todayStr}
                                value={filterResolvedDate}
                                onChange={(e) => setFilterResolvedDate(e.target.value)}
                                className={`w-full px-3 py-2 border border-[var(--border-secondary)] rounded-md bg-[var(--bg-primary)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all text-xs cursor-pointer ${!filterResolvedDate ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}
                            />
                            {filterResolvedDate && (
                                <button onClick={() => setFilterResolvedDate('')} className="absolute inset-y-0 right-7 pr-1 flex items-center text-[var(--text-muted)] hover:text-red-500 transition-colors z-10 bg-[var(--bg-primary)]">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-[var(--bg-card)] rounded-xl shadow-[var(--shadow-sm)] border border-[var(--border-secondary)] flex flex-col flex-1 overflow-hidden border-t-4 border-t-[var(--accent-primary)]">
                {/* Table Area */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead className="sticky top-0 bg-[var(--bg-secondary)] shadow-sm z-10">
                            <tr>
                                <th className="py-3 px-5 font-semibold text-[var(--text-secondary)] text-xs tracking-wider uppercase border-b border-[var(--border-secondary)] whitespace-nowrap">Ticket ID</th>
                                <th className="py-3 px-5 font-semibold text-[var(--text-secondary)] text-xs tracking-wider uppercase border-b border-[var(--border-secondary)] whitespace-nowrap">Agent ID</th>
                                <th className="py-3 px-5 font-semibold text-[var(--text-secondary)] text-xs tracking-wider uppercase border-b border-[var(--border-secondary)]">Issue Topic</th>
                                <th className="py-3 px-5 font-semibold text-[var(--text-secondary)] text-xs tracking-wider uppercase border-b border-[var(--border-secondary)] whitespace-nowrap">Status</th>
                                <th className="py-3 px-5 font-semibold text-[var(--text-secondary)] text-xs tracking-wider uppercase border-b border-[var(--border-secondary)] whitespace-nowrap">Issue Date</th>
                                <th className="py-3 px-5 font-semibold text-[var(--text-secondary)] text-xs tracking-wider uppercase border-b border-[var(--border-secondary)] whitespace-nowrap">Resolved Date</th>
                                <th className="py-3 px-5 font-semibold text-[var(--text-secondary)] text-xs tracking-wider uppercase border-b border-[var(--border-secondary)] text-right">Attachment</th>
                            </tr>
                        </thead>
                        <tbody className={isFiltering ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>
                            {tickets.length > 0 ? (
                                tickets.map((t: Ticket) => (
                                    <tr
                                        key={t.issueId}
                                        onClick={() => setSelectedTicket(t)}
                                        className="transition-colors border-b border-[var(--border-primary)] hover:bg-[var(--bg-tertiary)] cursor-pointer group"
                                    >
                                        <td className="py-2.5 px-5 font-mono font-semibold text-[var(--accent-primary)] group-hover:text-indigo-600 text-sm">
                                            {t.issueId}
                                        </td>
                                        <td className="py-2.5 px-5 text-sm font-medium text-[var(--text-primary)]">
                                            {t.agentId}
                                        </td>
                                        <td className="py-2.5 px-5 text-sm text-[var(--text-primary)] truncate max-w-[200px]" title={t.code}>
                                            {t.code}
                                        </td>
                                        <td className="py-2.5 px-5 text-sm text-[var(--text-primary)]">
                                            <StatusBadge status={t.status} />
                                        </td>
                                        <td className="py-2.5 px-5 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                                            {new Date(t.issueDate).toLocaleString()}
                                        </td>
                                        <td className="py-2.5 px-5 text-xs text-[var(--text-secondary)] font-medium whitespace-nowrap">
                                            {t.resolvedDate ? new Date(t.resolvedDate).toLocaleString() : 'N/A'}
                                        </td>
                                        <td className="py-2.5 px-5 text-right">
                                            <button
                                                onClick={(e) => handleViewAttachment(e, t.issueId)}
                                                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-secondary)] rounded-md transition-colors inline-flex items-center justify-center border border-transparent hover:border-[var(--border-primary)]"
                                                title="View Attachment"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="py-10 text-center text-[var(--text-muted)] italic">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <svg className="w-10 h-10 text-[var(--text-muted)]/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                            <span className="text-sm">
                                                {tickets.length > 0 ? 'No tickets match your search filters.' : 'No tickets have been created yet.'}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="px-5 py-3 border-t border-[var(--border-secondary)] bg-[var(--bg-tertiary)] flex justify-between items-center shrink-0">
                        <span className="text-xs text-[var(--text-secondary)]">
                            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalResults)} of {totalResults} entries
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                disabled={currentPage === 1}
                                onClick={(e) => { e.stopPropagation(); setCurrentPage(p => p - 1); }}
                                className="px-3 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border-secondary)] text-[var(--text-primary)] text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--bg-secondary)] transition-colors"
                            >
                                Previous
                            </button>
                            <span className="text-xs font-semibold text-[var(--text-primary)] px-2">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                disabled={currentPage === totalPages}
                                onClick={(e) => { e.stopPropagation(); setCurrentPage(p => p + 1); }}
                                className="px-3 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border-secondary)] text-[var(--text-primary)] text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--bg-secondary)] transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <CreateTicketModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={() => fetchFilteredTickets()}
            />

            <SupervisorTicketDetailsModal
                isOpen={!!selectedTicket}
                onClose={() => setSelectedTicket(null)}
                ticket={selectedTicket}
                onTicketUpdate={() => {
                    fetchFilteredTickets();
                }}
                readOnly={true}
            />

            {/* Inline Attachment Modal */}
            {attachmentModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[2000] flex justify-center items-center opacity-100 transition-opacity p-4">
                    <div className="bg-[var(--bg-card)] w-full max-w-[600px] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-[var(--border-primary)]">
                        <div className="px-5 py-3 border-b border-[var(--border-primary)] bg-[var(--bg-modal-header)] flex justify-between items-center">
                            <h3 className="m-0 text-base text-[var(--text-primary)] font-semibold flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                View Attachment
                            </h3>
                            <button
                                onClick={() => setAttachmentModalOpen(false)}
                                className="text-[var(--text-muted)] hover:text-red-500 transition-colors bg-transparent border-none cursor-pointer"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-6 bg-[var(--bg-secondary)] flex items-center justify-center min-h-[200px]">
                            {isFetchingAttachment ? (
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-6 h-6 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin"></div>
                                    <span className="text-sm font-medium text-[var(--text-muted)]">Loading attachment...</span>
                                </div>
                            ) : attachmentError ? (
                                <div className="text-center flex flex-col items-center gap-2">
                                    <svg className="w-10 h-10 text-[var(--text-muted)]/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <p className="text-[var(--text-muted)] font-medium text-sm m-0">{attachmentError}</p>
                                </div>
                            ) : attachmentUrl ? (
                                <div className="w-full flex justify-center content-center max-h-[60vh] overflow-hidden rounded-lg shadow-inner bg-black/5 p-2">
                                    {attachmentType?.startsWith('image/') ? (
                                        <img src={attachmentUrl} alt="Attachment" className="max-w-full object-contain rounded-md" />
                                    ) : attachmentType?.startsWith('audio/') ? (
                                        <audio src={attachmentUrl} controls className="w-full mt-2" />
                                    ) : (
                                        <a href={attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--accent-primary)] hover:underline font-medium text-sm">Download Attachment</a>
                                    )}
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
