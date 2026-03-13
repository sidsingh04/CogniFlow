import React, { useState, useEffect } from 'react';
import axiosInstance from '../../utils/axiosInstance';
import { v4 as uuidv4 } from "uuid";

interface TicketDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    ticket?: any;
    agent?: any;
    onTicketUpdate?: () => void;
}

export default function TicketDetailsModal({ isOpen, onClose, ticket, agent, onTicketUpdate }: TicketDetailsModalProps) {
    const [remarks, setRemarks] = useState('');
    const [callDuration, setCallDuration] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
    const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);

    // Cleanup object URL
    useEffect(() => {
        return () => {
            if (attachmentPreview) {
                URL.revokeObjectURL(attachmentPreview);
            }
        };
    }, [attachmentPreview]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/') && !file.type.startsWith('audio/')) {
            alert('Please select a valid image or audio file.');
            e.target.value = ''; // Reset
            return;
        }

        setAttachmentFile(file);

        // Create local preview
        const url = URL.createObjectURL(file);
        setAttachmentPreview(url);
    };

    const handleClearFile = () => {
        setAttachmentFile(null);
        if (attachmentPreview) {
            URL.revokeObjectURL(attachmentPreview);
            setAttachmentPreview(null);
        }
        // Reset the file input element
        const fileInput = document.getElementById('approvalAttachment') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
    };

    if (!isOpen || !ticket) return null;

    const handleApproval = async () => {
        if (!remarks) {
            alert('Please enter remarks before sending for approval.');
            return;
        }

        const duration = parseInt(callDuration, 10);
        if (isNaN(duration) || duration < 0) {
            alert('Please enter a valid call duration.');
            return;
        }

        setIsSubmitting(true);

        try {
            // Conditionally upload attachment to S3 first
            if (attachmentFile) {
                const formData = new FormData();
                formData.append('file', attachmentFile);
                formData.append('ticketId', ticket._id);

                await axiosInstance.post(
                    '/api/attachments/upload',
                    formData,
                    {
                        headers: {
                            'Content-Type': 'multipart/form-data',
                        }
                    }
                );
            }

            const updatedTicket = {
                issueId: ticket.issueId,
                status: 'approval',
                remarks,
                callDuration: duration,
                approvalDate: new Date().toUTCString(),
            };

            await axiosInstance.put(
                '/api/ticket/update',
                updatedTicket,
                {
                    headers: {
                        "x-idempotency-key": uuidv4()
                    }
                }
            );

            // Revert UI fields back
            setRemarks('');
            setCallDuration('');
            handleClearFile();
            if (onTicketUpdate) onTicketUpdate();
            onClose();

        } catch (error) {
            console.error('Error sending for approval:', error);
            alert('Failed to update ticket status.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[1000] flex justify-center items-center opacity-100 transition-opacity">
            <div className="bg-[var(--bg-card)] w-[90%] max-w-[500px] rounded-xl shadow-[var(--shadow-modal)] flex flex-col overflow-hidden transform transition-transform translate-y-0 border border-[var(--border-primary)] max-h-[90vh]">

                {/* Header */}
                <div className="px-6 py-4 border-b border-[var(--border-primary)] bg-[var(--bg-modal-header)] flex justify-between items-center">
                    <h3 className="m-0 text-lg text-[var(--text-primary)] font-semibold">Ticket Details</h3>
                    <button
                        onClick={onClose}
                        className="bg-transparent border-none text-2xl cursor-pointer text-[var(--text-muted)] hover:text-red-500 transition-colors"
                    >
                        &times;
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto max-h-[70vh] flex flex-col gap-6">
                    {/* Meta Information Grid */}
                    <div className="grid grid-cols-2 gap-4 bg-[var(--bg-secondary)] p-4 rounded-lg border border-[var(--border-secondary)]">
                        <div className="flex flex-col gap-1">
                            <span className="text-[0.8rem] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Ticket ID</span>
                            <span className="text-[0.95rem] font-mono text-[var(--text-primary)]">{ticket.issueId}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[0.8rem] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Status</span>
                            <div>
                                <span className={`inline-block px-2.5 py-1 text-xs font-bold rounded-md uppercase ${ticket.status === 'resolved' ? 'bg-green-100 text-green-700' :
                                    ticket.status === 'approval' ? 'bg-orange-100 text-orange-700' :
                                        'bg-blue-100 text-blue-700'
                                    }`}>
                                    {ticket.status}
                                </span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[0.8rem] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Issue Code</span>
                            <span className="text-[0.95rem] font-medium text-[var(--text-primary)]">{ticket.code}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[0.8rem] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Issue Date</span>
                            <span className="text-[0.95rem] text-[var(--text-primary)]">{new Date(ticket.issueDate).toLocaleString()}</span>
                        </div>
                        {ticket.resolvedDate && (
                            <div className="flex flex-col gap-1">
                                <span className="text-[0.8rem] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Resolved Date</span>
                                <span className="text-[0.95rem] text-[var(--text-primary)]">{new Date(ticket.resolvedDate).toLocaleString()}</span>
                            </div>
                        )}
                        {ticket.callDuration > 0 && ticket.status !== 'pending' && (
                            <div className="flex flex-col gap-1">
                                <span className="text-[0.8rem] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Call Duration</span>
                                <span className="text-[0.95rem] text-[var(--text-primary)]">{ticket.callDuration} mins</span>
                            </div>
                        )}
                    </div>

                    {ticket.title && (
                        <div className="flex flex-col gap-2">
                            <span className="text-sm font-semibold text-[var(--text-primary)]">Title:</span>
                            <p className="bg-[var(--bg-tertiary)] p-4 rounded-md font-semibold leading-relaxed m-0 border border-[var(--border-secondary)] text-[var(--text-primary)] text-[0.95rem]">
                                {ticket.title}
                            </p>
                        </div>
                    )}

                    <div className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-[var(--text-primary)]">Description:</span>
                        <p className="bg-[var(--bg-tertiary)] p-4 rounded-md font-normal leading-relaxed m-0 border border-[var(--border-secondary)] text-[var(--text-primary)] whitespace-pre-wrap text-[0.95rem]">
                            {ticket.description}
                        </p>
                    </div>

                    {ticket.status !== 'pending' && ticket.remarks && ticket.remarks !== "Initial ticket creation" && (
                        <div className="flex flex-col gap-2">
                            <span className="text-sm font-semibold text-[var(--text-primary)]">Agent Remarks:</span>
                            <div className="bg-[var(--bg-tertiary)] p-4 rounded-md border border-[var(--border-secondary)] text-[0.95rem] italic text-[var(--text-primary)] whitespace-pre-wrap">
                                "{ticket.remarks}"
                            </div>
                        </div>
                    )}

                    {ticket.status === 'pending' && (
                        <>
                            <hr className="border-t border-[var(--border-primary)] my-2" />

                            <div className="flex flex-col gap-2">
                                <label htmlFor="ticketRemarks" className="text-sm font-semibold text-[var(--text-primary)]">Agent Remarks <span className="text-red-500">*</span></label>
                                <textarea
                                    id="ticketRemarks"
                                    className="p-3 border border-[var(--border-secondary)] rounded-md bg-[var(--bg-card)] text-[var(--text-primary)] font-sans text-[0.95rem] outline-none transition-colors w-full focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] disabled:bg-[var(--bg-secondary)] disabled:cursor-not-allowed"
                                    placeholder={agent?.status === 'Break' ? 'Action disabled while on break.' : 'Enter resolution details or remarks...'}
                                    rows={4}
                                    disabled={agent?.status === 'Break' || isSubmitting}
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label htmlFor="ticketCallDuration" className="text-sm font-semibold text-[var(--text-primary)]">Call Duration (minutes) <span className="text-red-500">*</span></label>
                                <input
                                    type="number"
                                    id="ticketCallDuration"
                                    min="0"
                                    placeholder="e.g. 15"
                                    className="p-3 border border-[var(--border-secondary)] rounded-md bg-[var(--bg-card)] text-[var(--text-primary)] font-sans text-[0.95rem] outline-none transition-colors w-full focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] disabled:bg-[var(--bg-secondary)] disabled:cursor-not-allowed"
                                    disabled={agent?.status === 'Break' || isSubmitting}
                                    value={callDuration}
                                    onChange={(e) => setCallDuration(e.target.value)}
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label htmlFor="approvalAttachment" className="text-sm font-semibold text-[var(--text-primary)]">Attachment (Image/Audio)</label>
                                <input
                                    type="file"
                                    id="approvalAttachment"
                                    accept="image/*,audio/*"
                                    onChange={handleFileChange}
                                    disabled={agent?.status === 'Break' || isSubmitting}
                                    className="p-3 border border-[var(--border-secondary)] rounded-md bg-[var(--bg-card)] text-[var(--text-primary)] font-sans text-[0.95rem] outline-none transition-colors w-full focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
                                />
                                {attachmentPreview && attachmentFile && (
                                    <div className="mt-2 relative rounded-md border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-2">
                                        <button
                                            onClick={handleClearFile}
                                            disabled={isSubmitting}
                                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 transition-colors z-10"
                                            title="Remove attachment"
                                        >
                                            ×
                                        </button>
                                        {attachmentFile.type.startsWith('image/') ? (
                                            <img src={attachmentPreview} alt="Preview" className="max-w-full max-h-[150px] object-contain mx-auto rounded-sm" />
                                        ) : attachmentFile.type.startsWith('audio/') ? (
                                            <audio src={attachmentPreview} controls className="w-full mt-2" />
                                        ) : null}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-[var(--border-primary)] flex justify-end gap-3 bg-[var(--bg-modal-header)]">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-md font-medium cursor-pointer text-[0.95rem] transition-colors bg-[var(--bg-card)] border border-[var(--border-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                    >
                        Close
                    </button>
                    {ticket.status === 'pending' && (
                        <button
                            onClick={handleApproval}
                            disabled={agent?.status === 'Break' || isSubmitting}
                            className="px-5 py-2.5 rounded-md font-medium cursor-pointer text-[0.95rem] transition-colors bg-[var(--accent-secondary)] text-[var(--text-primary)] border-none hover:bg-[var(--accent-primary)] disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Sending...' : 'Send for Approval'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
