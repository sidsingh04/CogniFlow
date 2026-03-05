import { useState, useEffect } from 'react';
import axios from 'axios';
import socket from '../../services/socket';
import SupervisorTicketDetailsModal from './SupervisorTicketDetailsModal';

interface Ticket {
    issueId: string;
    code: string;
    description: string;
    status: string;
    agentId: string;
    issueDate: string;
    approvalDate?: string;
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

export default function ApprovalTab() {
    const [approvalTickets, setApprovalTickets] = useState<Ticket[]>([]);
    const [totalResults, setTotalResults] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [isFiltering, setIsFiltering] = useState(false);
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

    const [filterIssueDate, setFilterIssueDate] = useState('');
    const todayStr = new Date().toISOString().split('T')[0];

    const [sortOption, setSortOption] = useState('approvalDate-desc');

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedAgentId, debouncedCode, filterIssueDate, sortOption]);

    const fetchFilteredApprovals = async (page = currentPage) => {
        setIsFiltering(true);
        try {
            const [sortField, sortOrder] = sortOption.split('-');

            const params: Record<string, string | number> = {
                page,
                limit: itemsPerPage,
                status: 'approval',
                sortField,
                sortOrder
            };

            if (debouncedAgentId.trim()) params.agentId = debouncedAgentId.trim();
            if (debouncedCode.trim()) params.code = debouncedCode.trim();
            if (filterIssueDate) params.issueDate = filterIssueDate;

            const res = await axios.get('http://localhost:3000/api/ticket/get-filtered', { params });
            if (res.data.success) {
                setApprovalTickets(res.data.tickets);
                setTotalResults(res.data.pagination.total);
                setTotalPages(res.data.pagination.totalPages);
            }
        } catch (error) {
            console.error("Error fetching approval tickets:", error);
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
        fetchFilteredApprovals(currentPage);
    }, [debouncedAgentId, debouncedCode, filterIssueDate, sortOption, currentPage]);

    useEffect(() => {
        socket.connect();
        const refreshTickets = () => {
            fetchFilteredApprovals(currentPage);
        };

        socket.on("ticketAssigned", refreshTickets);
        socket.on("ticketApprovalSent", refreshTickets);
        socket.on("ticketResolved", refreshTickets);
        socket.on("ticketRejected", refreshTickets);

        return () => {
            socket.off("ticketAssigned", refreshTickets);
            socket.off("ticketApprovalSent", refreshTickets);
            socket.off("ticketResolved", refreshTickets);
            socket.off("ticketRejected", refreshTickets);
        };
    }, [currentPage, debouncedAgentId, debouncedCode, filterIssueDate, sortOption]);

    if (isInitialLoading) {
        return <div className="p-8 text-center text-[var(--text-muted)] italic flex-1 flex items-center justify-center">Loading approval tickets...</div>;
    }

    return (
        <div className="px-4 py-2 h-full flex flex-col gap-3">

            {/* Control Panel */}
            <div className="bg-[var(--bg-card)] rounded-xl shadow-[var(--shadow-sm)] border border-[var(--border-secondary)] overflow-hidden shrink-0">
                <div className="px-4 py-2 bg-[var(--bg-tertiary)] border-b border-[var(--border-secondary)] flex justify-between items-center">
                    <h2 className="text-sm font-bold text-[var(--text-primary)] m-0 flex items-center gap-2">
                        <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                        Filter & Sort
                    </h2>
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">
                        {totalResults} result{totalResults !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* Using a flex layout with flex-1 ensures all inputs share the single row equally on desktop */}
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

                    {/* Sort Dropdown */}
                    <div className="flex flex-col gap-1.5 flex-[1.5] min-w-[180px]">
                        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">Sort Orders</label>
                        <select
                            value={sortOption}
                            onChange={(e) => setSortOption(e.target.value)}
                            className="w-full px-3 py-2 border border-[var(--border-secondary)] rounded-md bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all text-xs appearance-none cursor-pointer"
                            style={{ backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>')`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.2em 1.2em' }}
                        >
                            <option value="approvalDate-desc">Newest Sent</option>
                            <option value="approvalDate-asc">Oldest Sent</option>
                            <option value="issueDate-desc">Newest Created</option>
                            <option value="issueDate-asc">Oldest Created</option>
                        </select>
                    </div>

                    {/* Date Pickers */}
                    <div className="flex flex-col gap-1.5 flex-[1] min-w-[140px] max-w-[200px]">
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
                </div>
            </div>

            <div className="bg-[var(--bg-card)] rounded-xl shadow-[var(--shadow-sm)] border border-[var(--border-secondary)] flex flex-col flex-1 overflow-hidden border-t-4 border-t-[var(--accent-primary)]">
                {/* Header */}
                <div className="px-4 py-2 border-b border-[var(--border-secondary)] flex justify-between items-center bg-[var(--bg-tertiary)]">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-[var(--accent-secondary)] text-white rounded-md shadow-sm">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <h2 className="text-base font-bold text-[var(--text-primary)] m-0">Pending Approvals</h2>
                    </div>
                </div>

                {/* Table Area */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead className="sticky top-0 bg-[var(--bg-secondary)] shadow-sm z-10">
                            <tr>
                                <th className="py-3 px-5 font-semibold text-[var(--text-secondary)] text-xs tracking-wider uppercase border-b border-[var(--border-secondary)]">Ticket ID</th>
                                <th className="py-3 px-5 font-semibold text-[var(--text-secondary)] text-xs tracking-wider uppercase border-b border-[var(--border-secondary)]">Agent ID</th>
                                <th className="py-3 px-5 font-semibold text-[var(--text-secondary)] text-xs tracking-wider uppercase border-b border-[var(--border-secondary)]">Issue Topic</th>
                                <th className="py-3 px-5 font-semibold text-[var(--text-secondary)] text-xs tracking-wider uppercase border-b border-[var(--border-secondary)]">Issue Date</th>
                                <th className="py-3 px-5 font-semibold text-[var(--text-secondary)] text-xs tracking-wider uppercase border-b border-[var(--border-secondary)]">Sent For Approval</th>
                                <th className="py-3 px-5 font-semibold text-[var(--text-secondary)] text-xs tracking-wider uppercase border-b border-[var(--border-secondary)] text-right">Attachment</th>
                            </tr>
                        </thead>
                        <tbody className={isFiltering ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>
                            {approvalTickets.length > 0 ? (
                                approvalTickets.map((t: Ticket) => (
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
                                        <td className="py-2.5 px-5 text-sm text-[var(--text-primary)] truncate max-w-[250px]">
                                            {t.code}
                                        </td>
                                        <td className="py-2.5 px-5 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                                            {new Date(t.issueDate).toLocaleString()}
                                        </td>
                                        <td className="py-2.5 px-5 text-xs text-[var(--text-secondary)] font-medium whitespace-nowrap">
                                            {t.approvalDate ? new Date(t.approvalDate).toLocaleString() : 'N/A'}
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
                                    <td colSpan={6} className="py-10 text-center text-[var(--text-muted)] italic">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <svg className="w-10 h-10 text-[var(--text-muted)]/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                            <span className="text-sm">
                                                No items pending approval at this time.
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

            <SupervisorTicketDetailsModal
                isOpen={!!selectedTicket}
                onClose={() => setSelectedTicket(null)}
                ticket={selectedTicket}
                onTicketUpdate={() => {
                    fetchFilteredApprovals();
                }}
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
