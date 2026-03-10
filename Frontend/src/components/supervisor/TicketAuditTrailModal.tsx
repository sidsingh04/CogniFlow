import { useState, useEffect } from 'react';
import axiosInstance from '../../utils/axiosInstance';
import { format } from 'date-fns';

interface TicketAuditTrailModalProps {
    isOpen: boolean;
    onClose: () => void;
    ticketId: string | null;
}

interface AuditEvent {
    type: 'CREATED' | 'APPROVAL_REQUEST' | 'REJECTED' | 'RESOLVED' | 'ATTACHMENT';
    timestamp: string;
    message: string;
    agentId?: string;
    remarks?: string;
    callDuration?: number;
    mediaUrl?: string;
    fileType?: string;
}

export default function TicketAuditTrailModal({ isOpen, onClose, ticketId }: TicketAuditTrailModalProps) {
    const [events, setEvents] = useState<AuditEvent[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen || !ticketId) return;

        const fetchAuditTrail = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const res = await axiosInstance.get(`/api/ticket/audit-trail/${ticketId}`);
                if (res.data.success) {
                    setEvents(res.data.events);
                } else {
                    setError('Failed to load audit trail');
                }
            } catch (err: any) {
                console.error('Error fetching audit trail:', err);
                setError(err.response?.data?.message || 'Error loading audit trail');
            } finally {
                setIsLoading(false);
            }
        };

        fetchAuditTrail();
    }, [isOpen, ticketId]);

    if (!isOpen) return null;

    const getEventIcon = (type: string) => {
        switch (type) {
            case 'CREATED': return '📝';
            case 'APPROVAL_REQUEST': return '📤';
            case 'REJECTED': return '❌';
            case 'RESOLVED': return '✅';
            case 'ATTACHMENT': return '📎';
            default: return '📌';
        }
    };

    const getEventColor = (type: string) => {
        switch (type) {
            case 'CREATED': return 'bg-blue-100 text-blue-600 border-blue-200';
            case 'APPROVAL_REQUEST': return 'bg-yellow-100 text-yellow-600 border-yellow-200';
            case 'REJECTED': return 'bg-red-100 text-red-600 border-red-200';
            case 'RESOLVED': return 'bg-green-100 text-green-600 border-green-200';
            case 'ATTACHMENT': return 'bg-gray-100 text-gray-600 border-gray-200';
            default: return 'bg-gray-100 text-gray-600 border-gray-200';
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[1000] flex justify-center items-center opacity-100 transition-opacity">
            <div className="bg-[var(--bg-card)] w-[90%] max-w-[600px] rounded-xl shadow-[var(--shadow-modal)] flex flex-col overflow-hidden border border-[var(--border-primary)] max-h-[90vh]">

                {/* Header */}
                <div className="px-6 py-4 border-b border-[var(--border-primary)] bg-[var(--bg-modal-header)] flex justify-between items-center">
                    <div>
                        <h3 className="m-0 text-lg text-[var(--text-primary)] font-semibold flex items-center gap-2">
                            <span>⏱️</span> Ticket Audit Trail
                        </h3>
                        {ticketId && <p className="text-sm text-[var(--text-muted)] m-0 mt-1 font-mono">{ticketId}</p>}
                    </div>
                    <button
                        onClick={onClose}
                        className="bg-transparent border-none text-2xl cursor-pointer text-[var(--text-muted)] hover:text-red-500 transition-colors"
                    >
                        &times;
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto max-h-[70vh] bg-[var(--bg-primary)]">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-40">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-primary)]"></div>
                        </div>
                    ) : error ? (
                        <div className="text-center p-6 bg-red-50 text-red-600 rounded-lg border border-red-200">
                            {error}
                        </div>
                    ) : events.length === 0 ? (
                        <div className="text-center p-8 text-[var(--text-muted)] italic bg-[var(--bg-card)] rounded-lg border border-[var(--border-secondary)]">
                            No audit events found for this ticket.
                        </div>
                    ) : (
                        <div className="relative pl-4 border-l-2 border-[var(--border-secondary)] ml-4 space-y-8 pb-4">
                            {events.map((event, index) => (
                                <div key={index} className="relative">
                                    {/* Timeline dot */}
                                    <div className={`absolute -left-[25px] flex items-center justify-center w-8 h-8 rounded-full border-2 ${getEventColor(event.type)} bg-[var(--bg-card)] shadow-sm text-sm`}>
                                        {getEventIcon(event.type)}
                                    </div>

                                    {/* Content Card */}
                                    <div className="ml-6 bg-[var(--bg-card)] p-4 rounded-lg border border-[var(--border-primary)] shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className={`px-2 py-0.5 text-xs font-bold uppercase rounded-md ${getEventColor(event.type).split(' ')[0]} ${getEventColor(event.type).split(' ')[1]}`}>
                                                {event.type.replace('_', ' ')}
                                            </span>
                                            <span className="text-xs font-medium text-[var(--text-muted)] whitespace-nowrap ml-2">
                                                {format(new Date(event.timestamp), 'MMM d, yyyy • h:mm a')}
                                            </span>
                                        </div>

                                        <h4 className="text-[0.95rem] font-semibold text-[var(--text-primary)] m-0 mb-1">
                                            {event.message}
                                        </h4>

                                        {/* Extra Details based on type */}
                                        {event.remarks && (
                                            <div className="mt-2 text-sm text-[var(--text-secondary)] bg-[var(--bg-tertiary)] p-2 rounded border border-[var(--border-secondary)] italic">
                                                "{event.remarks}"
                                            </div>
                                        )}

                                        {event.callDuration !== undefined && (
                                            <div className="mt-2 text-sm text-[var(--text-secondary)] flex items-center gap-1 font-medium">
                                                <span>📞 {event.type === 'RESOLVED' ? 'Total Duration' : 'Duration'}: {event.callDuration} mins</span>
                                            </div>
                                        )}

                                        {event.type === 'ATTACHMENT' && event.mediaUrl && (
                                            <div className="mt-3 rounded overflow-hidden border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-2 max-w-sm">
                                                {event.fileType?.startsWith('image') ? (
                                                    <img src={event.mediaUrl} alt="Attachment" className="max-w-full h-auto rounded object-contain max-h-48 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(event.mediaUrl, '_blank')} />
                                                ) : event.fileType?.startsWith('audio') ? (
                                                    <audio src={event.mediaUrl} controls className="w-full h-10" />
                                                ) : (
                                                    <a href={event.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--accent-primary)] hover:underline flex items-center gap-1">
                                                        <span>📎</span> View File
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-[var(--border-primary)] flex justify-end bg-[var(--bg-modal-header)]">
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
