import { useState, useEffect } from 'react';
import axiosInstance from '../../utils/axiosInstance';

interface KBSuggestionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    ticket: any;
}

interface KBSolution {
    _id: string;
    title: string;
    description: string;
    solution: string[];
    confidenceScore: number;
    tags?: string[];
}

function FeedbackButtons({ documentId }: { documentId: string }) {
    const [voted, setVoted] = useState(false);
    const [statusText, setStatusText] = useState('');

    const handleVote = async (action: 'upvote' | 'downvote') => {
        if (voted) return;
        setVoted(true);
        try {
            const resp = await axiosInstance.put(`/api/knowledge/feedback-kb/${documentId}`, { action });
            if (resp.data) {
                setStatusText('Thanks for the feedback!');
            } else {
                setStatusText('Feedback failed.');
                setVoted(false);
            }
        } catch (e) {
            console.error(e);
            setStatusText('Network error.');
            setVoted(false);
        }
    };

    return (
        <div className="flex items-center gap-3 mt-2 text-xs">
            <span className="text-[var(--text-muted)]">Was this helpful?</span>
            <button
                onClick={() => handleVote('upvote')}
                disabled={voted}
                className={`px-2 py-0.5 rounded border border-[var(--border-secondary)] transition-colors cursor-pointer ${voted ? 'opacity-50 cursor-not-allowed' : 'hover:bg-emerald-50 hover:border-emerald-300'}`}
            >👍</button>
            <button
                onClick={() => handleVote('downvote')}
                disabled={voted}
                className={`px-2 py-0.5 rounded border border-[var(--border-secondary)] transition-colors cursor-pointer ${voted ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-50 hover:border-red-300'}`}
            >👎</button>
            {statusText && <span className="text-emerald-600 italic ml-auto">{statusText}</span>}
        </div>
    );
}

function getConfidenceColor(score: number): string {
    if (score > 0.75) return 'text-green-700 bg-green-100 border-green-200';
    if (score >= 0.60) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    return 'text-yellow-700 bg-yellow-50 border-yellow-200';
}

export default function KBSuggestionsModal({ isOpen, onClose, ticket }: KBSuggestionsModalProps) {
    const [solutions, setSolutions] = useState<KBSolution[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchMessage, setSearchMessage] = useState('');

    useEffect(() => {
        if (!isOpen || !ticket) return;

        const searchKB = async () => {
            setIsLoading(true);
            setError(null);
            setSolutions([]);
            setSearchMessage('');

            try {
                const res = await axiosInstance.post('/api/knowledge/search-kb', {
                    title: ticket.title || ticket.code || '',
                    description: ticket.description || ''
                });

                if (res.data.solutions && res.data.solutions.length > 0) {
                    setSolutions(res.data.solutions);
                    const topScore = res.data.solutions[0].confidenceScore;
                    setSearchMessage(
                        topScore > 0.75
                            ? 'High-confidence solutions found for this ticket:'
                            : 'Related articles that may help with this ticket:'
                    );
                } else {
                    setSearchMessage(res.data.message || 'No relevant solutions found in the knowledge base.');
                }
            } catch (err: any) {
                console.error('KB search error:', err);
                setError(err.response?.data?.message || 'Failed to search knowledge base.');
            } finally {
                setIsLoading(false);
            }
        };

        searchKB();
    }, [isOpen, ticket]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[1000] flex justify-center items-center transition-opacity">
            <div className="bg-[var(--bg-card)] w-[90%] max-w-[600px] rounded-xl shadow-[var(--shadow-modal)] flex flex-col overflow-hidden border border-[var(--border-primary)] max-h-[90vh]">

                {/* Header */}
                <div className="px-6 py-4 border-b border-[var(--border-primary)] bg-[var(--bg-modal-header)] flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg text-lg">📚</div>
                        <div>
                            <h3 className="m-0 text-lg text-[var(--text-primary)] font-semibold">KB Suggestions</h3>
                            <p className="m-0 text-xs text-[var(--text-muted)] font-mono mt-0.5">{ticket?.issueId}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="bg-transparent border-none text-2xl cursor-pointer text-[var(--text-muted)] hover:text-red-500 transition-colors"
                    >
                        &times;
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">

                    {/* Ticket context summary */}
                    <div className="bg-[var(--bg-secondary)] p-3 rounded-lg border border-[var(--border-secondary)] text-sm">
                        <span className="font-semibold text-[var(--text-secondary)]">Searching for: </span>
                        <span className="text-[var(--text-primary)]">{ticket?.title || ticket?.code}</span>
                    </div>

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <div className="w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-sm text-[var(--text-muted)] font-medium">Searching knowledge base...</span>
                        </div>
                    ) : error ? (
                        <div className="text-center p-6 bg-red-50 text-red-600 rounded-lg border border-red-200 text-sm">
                            {error}
                        </div>
                    ) : solutions.length > 0 ? (
                        <>
                            <p className="text-sm text-[var(--text-secondary)] m-0 font-medium">{searchMessage}</p>
                            <div className="flex flex-col gap-3">
                                {solutions.map((sol) => (
                                    <div
                                        key={sol._id}
                                        className="bg-[var(--bg-primary)] p-4 rounded-lg border border-[var(--border-secondary)] shadow-sm hover:shadow-md transition-shadow"
                                    >
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <span className="font-bold text-[0.95rem] text-[var(--accent-primary)]">
                                                {sol.title}
                                            </span>
                                            <span className={`text-[0.7rem] px-2 py-0.5 rounded-md font-bold border whitespace-nowrap shrink-0 ${getConfidenceColor(sol.confidenceScore)}`}>
                                                {Math.round(sol.confidenceScore * 100)}% match
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-2 mt-2 mb-3">
                                            {Array.isArray(sol.solution) ? sol.solution.map((text, idx) => (
                                                <div key={idx} className="p-3 bg-[var(--bg-secondary)] border-l-[3px] border-[var(--accent-primary)] rounded-r-md text-[0.9rem] text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed shadow-sm">
                                                    {text}
                                                </div>
                                            )) : (
                                                <p className="text-[0.9rem] text-[var(--text-primary)] m-0 leading-relaxed whitespace-pre-wrap">
                                                    {sol.solution}
                                                </p>
                                            )}
                                        </div>
                                        {sol.tags && sol.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                {sol.tags.map((tag, i) => (
                                                    <span key={i} className="text-[0.7rem] px-2 py-0.5 bg-[var(--bg-tertiary)] text-[var(--text-muted)] rounded-full border border-[var(--border-secondary)]">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        <FeedbackButtons documentId={sol._id} />
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-10 flex flex-col items-center gap-3">
                            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center text-2xl">🔍</div>
                            <p className="text-[var(--text-muted)] font-medium text-sm m-0">{searchMessage || 'No relevant solutions found in the knowledge base.'}</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-[var(--border-primary)] flex justify-end bg-[var(--bg-modal-header)] shrink-0">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-md font-medium cursor-pointer text-[0.95rem] transition-colors bg-[var(--bg-card)] border border-[var(--border-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
