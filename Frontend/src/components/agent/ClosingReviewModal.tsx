import { useState, useEffect } from 'react';
import axiosInstance from '../../utils/axiosInstance';

interface ClosingReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    ticket: any;
}

export default function ClosingReviewModal({ isOpen, onClose, onSuccess, ticket }: ClosingReviewModalProps) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [solution, setSolution] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');

    // Pre-fill fields when modal opens
    useEffect(() => {
        if (isOpen && ticket) {
            setTitle(ticket.title || ticket.code || '');
            setDescription(ticket.description || '');
            setSolution('');
            setError(null);
            setTags([]);
            setTagInput('');
        }
    }, [isOpen, ticket]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!solution.trim()) {
            setError('Solution is required');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const res = await axiosInstance.post('/api/knowledge/submit-review', {
                issueId: ticket.issueId,
                title,
                description,
                solution,
                tags
            });

            if (res.status === 201) {
                onSuccess(); // Triggers parent refresh
                onClose();
            }
        } catch (err: any) {
            console.error('Error submitting review:', err);
            setError(err.response?.data?.message || 'Failed to submit the review.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[1000] flex justify-center items-center overflow-y-auto pt-10 pb-10">
            <div className="bg-[var(--bg-card)] w-[90%] max-w-[600px] rounded-xl shadow-[var(--shadow-modal)] flex flex-col overflow-hidden border border-[var(--border-primary)] mt-auto mb-auto">
                {/* Header */}
                <div className="px-6 py-4 border-b border-[var(--border-primary)] bg-[var(--bg-modal-header)] flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg text-lg">✍️</div>
                        <div>
                            <h3 className="m-0 text-lg text-[var(--text-primary)] font-semibold">Write Closing Review</h3>
                            <p className="m-0 text-xs text-[var(--text-muted)] font-mono mt-0.5">{ticket?.issueId}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="bg-transparent border-none text-2xl cursor-pointer text-[var(--text-muted)] hover:text-red-500 transition-colors"
                        disabled={isLoading}
                    >
                        &times;
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col h-full">
                    <div className="p-6 flex flex-col gap-5 overflow-y-auto">
                        
                        {error && (
                            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200">
                                {error}
                            </div>
                        )}

                        {/* <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 text-sm text-[var(--text-secondary)]">
                            Writing a closing review converts this resolved ticket into a Knowledge Base article, helping other agents and customers automatically find this solution in the future.
                        </div> */}

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-semibold text-[var(--text-secondary)]">Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="p-3 border border-[var(--border-secondary)] rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all font-medium text-sm"
                                required
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-semibold text-[var(--text-secondary)]">Description (The Problem)</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={4}
                                className="p-3 border border-[var(--border-secondary)] rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all text-sm resize-y"
                                required
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-semibold text-[var(--text-secondary)]">
                                Solution <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={solution}
                                onChange={(e) => setSolution(e.target.value)}
                                placeholder="Explain step-by-step how to resolve this issue..."
                                rows={6}
                                className="p-3 border border-[var(--border-secondary)] rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all text-sm resize-y shadow-inner"
                                required
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-semibold text-[var(--text-secondary)]">Tags</label>
                            <input
                                type="text"
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const trimmed = tagInput.trim().toLowerCase();
                                        if (trimmed && !tags.includes(trimmed)) {
                                            setTags([...tags, trimmed]);
                                            setTagInput('');
                                        }
                                    }
                                }}
                                placeholder="Type a tag and press Enter"
                                className="p-3 border border-[var(--border-secondary)] rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all font-medium text-sm"
                            />
                            {tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {tags.map((tag, idx) => (
                                        <div key={idx} className="flex items-center gap-1.5 px-3 py-1 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-full text-xs font-medium text-[var(--text-secondary)]">
                                            <span>{tag}</span>
                                            <button
                                                type="button"
                                                onClick={() => setTags(tags.filter((_, i) => i !== idx))}
                                                className="text-[var(--text-muted)] hover:text-red-500 bg-transparent border-none cursor-pointer p-0 text-sm leading-none"
                                            >
                                                &times;
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-[var(--border-primary)] flex justify-end gap-3 bg-[var(--bg-modal-header)] shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className="px-5 py-2.5 rounded-md font-medium cursor-pointer text-[0.95rem] transition-colors bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || !solution.trim() || !title.trim() || !description.trim()}
                            className="px-5 py-2.5 rounded-md font-medium cursor-pointer text-[0.95rem] transition-colors bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] border-none shadow-[var(--shadow-sm)] disabled:opacity-50 flex items-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                    Submitting...
                                </>
                            ) : (
                                'Submit to KB'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
