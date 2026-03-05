import React, { useState } from 'react';
import axios from 'axios';

interface Agent {
    agentId: string;
    name: string;
    status: string;
    enrolledDate?: string;
    totalPending: number;
    totalResolved: number;
    totalCallDuration?: string;
    successfulCalls?: number;
    failedCalls?: number;
    pendingApprovals?: number;
}

interface AgentDetailsModalProps {
    isOpen: boolean;
    agent: Agent | null;
    onClose: () => void;
}

export default function AgentDetailsModal({ isOpen, agent, onClose }: AgentDetailsModalProps) {
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    if (!isOpen || !agent) return null;

    const getInitials = (name: string) => name.charAt(0).toUpperCase();

    const handleForceLogout = async () => {
        if (!window.confirm(`Are you sure you want to force logout ${agent.name} (${agent.agentId})?`)) {
            return;
        }

        setIsLoggingOut(true);
        try {
            await axios.post('http://localhost:3000/api/agent/force-logout', {
                agentId: agent.agentId
            });
            alert('Force logout command sent successfully.');
            onClose();
        } catch (error) {
            console.error('Error sending force logout:', error);
            alert('Failed to send force logout command.');
        } finally {
            setIsLoggingOut(false);
        }
    };

    const calculateSuccessRate = () => {
        const success = agent.successfulCalls || 0;
        const failed = agent.failedCalls || 0;
        const total = success + failed;
        if (total === 0) return '0%';
        return Math.round((success / total) * 100) + '%';
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'Available': return 'bg-[var(--status-active-bg)] text-[var(--status-active-color)] border-[var(--status-active-border)]';
            case 'Busy': return 'bg-[var(--status-resolving-bg)] text-[var(--status-resolving-color)] border-[var(--status-resolving-border)]';
            case 'Break': return 'bg-[var(--status-pending-bg)] text-[var(--status-pending-color)] border-[var(--status-pending-border)]';
            default: return 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border-secondary)]';
        }
    };

    const getStatusDot = (status: string) => {
        switch (status) {
            case 'Available': return 'bg-[var(--status-active-color)]';
            case 'Busy': return 'bg-[var(--status-resolving-color)]';
            case 'Break': return 'bg-[var(--status-pending-color)]';
            default: return 'bg-gray-500';
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 transition-opacity duration-300"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="bg-[var(--bg-card)] rounded-xl shadow-[var(--shadow-lg)] w-full max-w-2xl border border-[var(--border-secondary)] overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-4">

                {/* Header Profile Area */}
                <div className="px-6 py-6 border-b border-[var(--border-secondary)] bg-[var(--bg-tertiary)] flex justify-between items-start shrink-0 relative">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 rounded-full bg-[var(--bg-primary)] text-[var(--accent-primary)] border-2 border-[var(--border-primary)] shadow-sm flex items-center justify-center text-3xl font-bold">
                            {getInitials(agent.name)}
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <h2 className="text-2xl font-bold text-[var(--text-primary)] m-0 leading-tight flex items-center gap-3">
                                {agent.name}
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${getStatusStyle(agent.status)} shadow-sm`}>
                                    <span className={`w-2 h-2 rounded-full ${getStatusDot(agent.status)}`}></span>
                                    {agent.status}
                                </span>
                            </h2>
                            <div className="flex items-center gap-3 text-sm">
                                <span className="px-2 py-0.5 bg-[var(--bg-secondary)] text-[var(--text-secondary)] rounded font-mono border border-[var(--border-primary)] font-semibold">
                                    {agent.agentId}
                                </span>
                                <span className="text-[var(--text-muted)] font-medium">
                                    Registered: {agent.enrolledDate ? new Date(agent.enrolledDate).toLocaleDateString() : 'N/A'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-1.5 absolute top-4 right-4 bg-transparent border-none text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-6 flex flex-col gap-6 overflow-y-auto bg-[var(--bg-primary)]">
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-4 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                            Performance & Metrics
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">

                            <div className="bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-secondary)] flex flex-col shadow-sm">
                                <span className="text-3xl font-bold text-[var(--accent-primary)]">{agent.totalPending || 0}</span>
                                <span className="text-xs font-semibold text-[var(--text-muted)] mt-1 uppercase tracking-wider">Total Pending</span>
                            </div>

                            <div className="bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-secondary)] flex flex-col shadow-sm">
                                <span className="text-3xl font-bold text-emerald-500">{agent.totalResolved || 0}</span>
                                <span className="text-xs font-semibold text-[var(--text-muted)] mt-1 uppercase tracking-wider">Total Resolved</span>
                            </div>

                            <div className="bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-secondary)] flex flex-col shadow-sm">
                                <span className="text-3xl font-bold text-amber-500">{agent.pendingApprovals || 0}</span>
                                <span className="text-xs font-semibold text-[var(--text-muted)] mt-1 uppercase tracking-wider">Pending Approvals</span>
                            </div>

                            <div className="bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-secondary)] flex flex-col shadow-sm">
                                <span className="text-3xl font-bold text-[var(--text-primary)]">{agent.successfulCalls || 0}</span>
                                <span className="text-xs font-semibold text-[var(--text-muted)] mt-1 uppercase tracking-wider">Successful Calls</span>
                            </div>

                            <div className="bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-secondary)] flex flex-col shadow-sm">
                                <span className="text-3xl font-bold text-rose-500">{agent.failedCalls || 0}</span>
                                <span className="text-xs font-semibold text-[var(--text-muted)] mt-1 uppercase tracking-wider">Failed Calls</span>
                            </div>

                            <div className="bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-secondary)] flex flex-col shadow-sm">
                                <span className="text-3xl font-bold text-[var(--status-active-color)]">{calculateSuccessRate()}</span>
                                <span className="text-xs font-semibold text-[var(--text-muted)] mt-1 uppercase tracking-wider">Success Rate</span>
                            </div>

                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-[var(--border-secondary)] bg-[var(--bg-tertiary)] flex justify-between items-center shrink-0">
                    <button
                        type="button"
                        onClick={handleForceLogout}
                        disabled={isLoggingOut}
                        className="px-4 py-2 rounded-lg border border-red-200 bg-red-50 text-red-600 font-semibold text-sm cursor-pointer hover:bg-red-100 hover:border-red-300 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        {isLoggingOut ? 'Sending...' : 'Force Logout'}
                    </button>

                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-card)] text-[var(--text-primary)] font-semibold text-sm cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors shadow-sm"
                    >
                        Done
                    </button>
                </div>

            </div>
        </div>
    );
}
