import React, { useState } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from "uuid";

interface SupervisorTicketDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    ticket?: any;
    onTicketUpdate?: () => void;
    readOnly?: boolean;
}

export default function SupervisorTicketDetailsModal({ isOpen, onClose, ticket, onTicketUpdate, readOnly = false }: SupervisorTicketDetailsModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen || !ticket) return null;

    const handleApprovalAction = async (isApproved: boolean) => {
        if (!window.confirm(
            `Are you sure you want to ${isApproved ? 'approve' : 'reject'} ticket ${ticket.issueId}?`
        )) return;

        setIsSubmitting(true);
        try {
            const updatedTicket: any = {
                issueId: ticket.issueId,
                status: isApproved ? "resolved" : "pending"
            };

            if (!isApproved) {
                updatedTicket.rejectedDate = new Date().toUTCString();
                updatedTicket.approvalDate = null;
            } else {
                updatedTicket.resolvedDate = new Date().toUTCString();
            }

            await axios.put(
                "http://localhost:3000/api/ticket/update",
                updatedTicket,
                {
                    headers: {
                        "x-idempotency-key": uuidv4()
                    }
                }
            );

            if (onTicketUpdate) onTicketUpdate();
            onClose();

        } catch (error) {
            console.error("Ticket approval error:", error);
            alert("Failed to update ticket.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[1000] flex justify-center items-center opacity-100 transition-opacity">
            <div className="bg-[var(--bg-card)] w-[90%] max-w-[600px] rounded-xl shadow-[var(--shadow-modal)] flex flex-col overflow-hidden transform transition-transform translate-y-0 border border-[var(--border-primary)] max-h-[90vh]">

                {/* Header */}
                <div className="px-6 py-4 border-b border-[var(--border-primary)] bg-[var(--bg-modal-header)] flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[var(--accent-secondary)] text-white rounded-lg">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <h3 className="m-0 text-lg text-[var(--text-primary)] font-semibold">{readOnly ? "Ticket Details" : "Approval Request"}</h3>
                    </div>
                    <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-md uppercase border border-blue-200">
                        {ticket.status}
                    </span>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto max-h-[70vh] flex flex-col gap-6">
                    {/* Meta Information Grid */}
                    <div className="grid grid-cols-2 gap-y-5 gap-x-6 bg-[var(--bg-secondary)] p-5 rounded-lg border border-[var(--border-secondary)] shadow-inner">
                        <div className="flex flex-col gap-1.5">
                            <span className="text-[0.8rem] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Ticket ID</span>
                            <span className="text-[1.05rem] font-mono font-bold text-[var(--text-primary)]">{ticket.issueId}</span>
                        </div>
                        <div className="flex flex-col gap-1.5 border-l border-[var(--border-secondary)] pl-6">
                            <span className="text-[0.8rem] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Agent ID</span>
                            <span className="text-[1.05rem] font-medium text-[var(--accent-primary)]">{ticket.agentId}</span>
                        </div>

                        {/* Divider Line */}
                        <div className="col-span-2 border-b border-[var(--border-secondary)] opacity-50 my-1"></div>

                        <div className="flex flex-col gap-1.5">
                            <span className="text-[0.8rem] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Issue Topic</span>
                            <span className="text-[0.95rem] font-medium text-[var(--text-primary)]">{ticket.code}</span>
                        </div>
                        <div className="flex flex-col gap-1.5 border-l border-[var(--border-secondary)] pl-6">
                            <span className="text-[0.8rem] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Created Date</span>
                            <span className="text-[0.95rem] font-medium text-[var(--text-primary)]">{new Date(ticket.issueDate).toLocaleString()}</span>
                        </div>

                        {(ticket.approvalDate || ticket.callDuration > 0) && (
                            <div className="col-span-2 border-b border-[var(--border-secondary)] opacity-50 my-1"></div>
                        )}

                        {ticket.approvalDate && (
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[0.8rem] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Sent For Approval</span>
                                <span className="text-[0.95rem] font-medium text-[var(--text-primary)]">{new Date(ticket.approvalDate).toLocaleString()}</span>
                            </div>
                        )}
                        {ticket.callDuration > 0 && (
                            <div className={`flex flex-col gap-1.5 ${ticket.approvalDate ? 'border-l border-[var(--border-secondary)] pl-6' : ''}`}>
                                <span className="text-[0.8rem] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Call Duration</span>
                                <span className="text-[0.95rem] font-bold text-[var(--text-primary)]">{ticket.callDuration} mins</span>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border-secondary)] pb-1 w-max">Initial Description</span>
                        <p className="bg-[var(--bg-tertiary)] p-4 rounded-md font-normal leading-relaxed m-0 border border-[var(--border-secondary)] text-[var(--text-primary)] whitespace-pre-wrap text-[0.95rem] shadow-sm">
                            {ticket.description}
                        </p>
                    </div>

                    {ticket.remarks && (
                        <div className="flex flex-col gap-2">
                            <span className="text-sm font-semibold text-[var(--accent-primary)] border-b border-[var(--border-secondary)] pb-1 w-max">Agent Final Remarks</span>
                            <div className="bg-[var(--bg-tertiary)] p-4 rounded-md border border-[var(--border-secondary)] text-[0.95rem] italic text-[var(--text-primary)] whitespace-pre-wrap shadow-sm border-l-4 border-l-[var(--accent-primary)]">
                                "{ticket.remarks}"
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className={`px-6 py-4 border-t border-[var(--border-primary)] flex gap-3 bg-[var(--bg-modal-header)] ${readOnly ? 'justify-end' : 'justify-between'}`}>
                    {!readOnly && (
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-md font-medium cursor-pointer text-[0.95rem] transition-colors bg-[var(--bg-card)] border border-[var(--border-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                        >
                            Cancel
                        </button>
                    )}

                    {!readOnly ? (
                        <div className="flex gap-3">
                            <button
                                onClick={() => handleApprovalAction(false)}
                                disabled={isSubmitting}
                                className="px-5 py-2.5 bg-[var(--bg-card)] border border-red-200 text-red-600 rounded-lg text-[0.95rem] font-semibold hover:bg-red-50 transition-colors cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Reject
                            </button>
                            <button
                                onClick={() => handleApprovalAction(true)}
                                disabled={isSubmitting}
                                className="px-6 py-2.5 bg-emerald-600 text-white border-none rounded-lg text-[0.95rem] font-semibold hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer flex items-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? (
                                    'Processing...'
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                        Approve
                                    </>
                                )}
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 rounded-md font-semibold cursor-pointer text-[0.95rem] transition-colors bg-red-600 text-white border-none hover:bg-red-700 shadow-sm"
                        >
                            Close
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
