import React, { useState, useEffect } from 'react';

interface PendingTicketsFilterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (filters: { searchQuery: string; startDate: string; endDate: string }) => void;
    initialFilters: { searchQuery: string; startDate: string; endDate: string };
}

export default function PendingTicketsFilterModal({
    isOpen,
    onClose,
    onApply,
    initialFilters
}: PendingTicketsFilterModalProps) {
    const [searchQuery, setSearchQuery] = useState(initialFilters.searchQuery);
    const [startDate, setStartDate] = useState(initialFilters.startDate);
    const [endDate, setEndDate] = useState(initialFilters.endDate);

    // Sync state when modal is opened with current active filters
    useEffect(() => {
        if (isOpen) {
            setSearchQuery(initialFilters.searchQuery);
            setStartDate(initialFilters.startDate);
            setEndDate(initialFilters.endDate);
        }
    }, [isOpen, initialFilters]);

    if (!isOpen) return null;

    const handleApply = () => {
        onApply({ searchQuery, startDate, endDate });
        onClose();
    };

    const handleClear = () => {
        setSearchQuery('');
        setStartDate('');
        setEndDate('');
        // Don't auto-apply on clear, let user click Apply or we can apply it
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div
                className="bg-[var(--bg-primary)] rounded-xl w-full max-w-md shadow-2xl flex flex-col border border-[var(--border-secondary)] animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center p-5 border-b border-[var(--border-secondary)]">
                    <h2 className="text-lg font-bold text-[var(--text-primary)]">Filter Pending Tickets</h2>
                    <button
                        onClick={onClose}
                        className="text-red-500 hover:text-red-700 transition-colors p-1 rounded-full hover:bg-red-50"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-5 flex flex-col gap-4">
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                            Search Query (ID or Subject)
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Enter ticket ID or part of subject"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full py-2.5 px-3 pl-9 border border-[var(--border-secondary)] rounded-lg text-sm outline-none transition-colors focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm"
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                                🔍
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <label className="block text-sm font-medium text-[var(--text-secondary)]">
                            Issue Date Range
                        </label>
                        <div className="flex gap-3">
                            <div className="flex-1">
                                <span className="block text-xs text-gray-500 mb-1">From:</span>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full py-2 px-3 border border-[var(--border-secondary)] rounded-lg text-sm outline-none transition-colors focus:border-[var(--accent-primary)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm"
                                />
                            </div>
                            <div className="flex-1">
                                <span className="block text-xs text-gray-500 mb-1">To:</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full py-2 px-3 border border-[var(--border-secondary)] rounded-lg text-sm outline-none transition-colors focus:border-[var(--accent-primary)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm"
                                />
                            </div>
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
