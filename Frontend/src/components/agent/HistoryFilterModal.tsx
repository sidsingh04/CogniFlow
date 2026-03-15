import { useState, useEffect } from 'react';

interface HistoryFilterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (filters: { issueId: string; code: string; status: string; issueDate: string; resolvedDate: string }) => void;
    initialFilters: { issueId: string; code: string; status: string; issueDate: string; resolvedDate: string };
}

export default function HistoryFilterModal({
    isOpen,
    onClose,
    onApply,
    initialFilters
}: HistoryFilterModalProps) {
    const [issueId, setIssueId] = useState(initialFilters.issueId);
    const [code, setCode] = useState(initialFilters.code);
    const [status, setStatus] = useState(initialFilters.status);
    const [issueDate, setIssueDate] = useState(initialFilters.issueDate);
    const [resolvedDate, setResolvedDate] = useState(initialFilters.resolvedDate);

    // Sync state when modal is opened with current active filters
    useEffect(() => {
        if (isOpen) {
            setIssueId(initialFilters.issueId);
            setCode(initialFilters.code);
            setStatus(initialFilters.status);
            setIssueDate(initialFilters.issueDate);
            setResolvedDate(initialFilters.resolvedDate);
        }
    }, [isOpen, initialFilters]);

    if (!isOpen) return null;

    const handleApply = () => {
        onApply({ issueId, code, status, issueDate, resolvedDate });
        onClose();
    };

    const handleClear = () => {
        setIssueId('');
        setCode('');
        setStatus('All');
        setIssueDate('');
        setResolvedDate('');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div
                className="bg-[var(--bg-primary)] rounded-xl w-full max-w-md shadow-2xl flex flex-col border border-[var(--border-secondary)] animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center p-5 border-b border-[var(--border-secondary)]">
                    <h2 className="text-lg font-bold text-[var(--text-primary)]">Filter History</h2>
                    <button
                        onClick={onClose}
                        className="text-red-500 hover:text-red-700 transition-colors p-1 rounded-full hover:bg-red-50"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                            Ticket ID
                        </label>
                        <input
                            type="text"
                            placeholder="Enter exact or partial Ticket ID"
                            value={issueId}
                            onChange={(e) => setIssueId(e.target.value)}
                            className="w-full py-2.5 px-3 border border-[var(--border-secondary)] rounded-lg text-sm outline-none transition-colors focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                            Subject (Code)
                        </label>
                        <input
                            type="text"
                            placeholder="Enter part of subject"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            className="w-full py-2.5 px-3 border border-[var(--border-secondary)] rounded-lg text-sm outline-none transition-colors focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                            Status
                        </label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="w-full py-2.5 px-3 border border-[var(--border-secondary)] rounded-lg text-sm outline-none transition-colors focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm"
                        >
                            <option value="All">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="approval">Approval</option>
                            <option value="resolved">Resolved</option>
                        </select>
                    </div>

                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                                Issue Date
                            </label>
                            <input
                                type="date"
                                value={issueDate}
                                onChange={(e) => setIssueDate(e.target.value)}
                                className="w-full py-2 px-3 border border-[var(--border-secondary)] rounded-lg text-sm outline-none transition-colors focus:border-[var(--accent-primary)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                                Resolved Date
                            </label>
                            <input
                                type="date"
                                value={resolvedDate}
                                onChange={(e) => setResolvedDate(e.target.value)}
                                className="w-full py-2 px-3 border border-[var(--border-secondary)] rounded-lg text-sm outline-none transition-colors focus:border-[var(--accent-primary)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm"
                            />
                        </div>
                    </div>
                </div>

                <div className="p-5 border-t border-[var(--border-secondary)] flex justify-between items-center bg-[var(--bg-secondary)] rounded-b-xl">
                    <button
                        onClick={handleClear}
                        className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors px-3 py-2 rounded hover:bg-gray-200 cursor-pointer"
                    >
                        Clear Filters
                    </button>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium border border-red-200 rounded-lg text-red-600 hover:bg-red-50 transition-colors cursor-pointer shadow-sm bg-white"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleApply}
                            className="px-4 py-2 text-sm font-medium bg-[var(--accent-primary)] text-white rounded-lg hover:bg-indigo-600 transition-colors cursor-pointer shadow-sm"
                        >
                            Apply Filters
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
