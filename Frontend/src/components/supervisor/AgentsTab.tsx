import { useState, useEffect } from 'react';
import axiosInstance from '../../utils/axiosInstance';
import AgentDetailsModal from './AgentDetailsModal';
import socket from '../../services/socket';

interface Agent {
    agentId: string;
    name: string;
    status: string;
    totalPending: number;
    totalResolved: number;
    pendingApprovals: number;
}

interface StatusUpdate {
    id: string;
    agentId: string;
    name: string;
    oldStatus?: string;
    status: string;
    timestamp: string;
}

export default function AgentsTab() {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [isFetching, setIsFetching] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
    const [metrics, setMetrics] = useState({
        total: 0,
        available: 0,
        break: 0,
        offline: 0,
        busy: 0
    });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [statusUpdates, setStatusUpdates] = useState<StatusUpdate[]>([]);

    const fetchAgents = async (isBackgroundLoad = false) => {
        if (!isBackgroundLoad) setIsLoading(true);
        setIsFetching(true);
        try {
            const res = await axiosInstance.get('/api/agent/getPaginatedAgents', {
                params: {
                    page: currentPage,
                    limit: 5,
                    search: debouncedSearchQuery
                }
            });
            if (res.data.success) {
                setAgents(res.data.agents);
                setTotalPages(res.data.pagination.totalPages || 1);
            }
        } catch (error) {
            console.error("Error fetching agents:", error);
        } finally {
            if (!isBackgroundLoad) setIsLoading(false);
            setIsFetching(false);
            setIsSearching(false);
        }
    };

    const fetchMetrics = async () => {
        try {
            const res = await axiosInstance.get('/api/analytics/agent-status-metrics');
            if (res.data.success) {
                setMetrics(res.data.metrics);
            }
        } catch (error) {
            console.error("Error fetching agent metrics:", error);
        }
    };

    // Fetch metrics purely on mount
    useEffect(() => {
        fetchMetrics();
    }, []);

    // Standard data fetch hook tracking page or debounce changes
    useEffect(() => {
        fetchAgents(agents.length > 0); // Load gracefully in background if we already have data
    }, [currentPage, debouncedSearchQuery]);

    // Socket.io real-time updates
    useEffect(() => {
        socket.connect();

        const handleStatusUpdate = (data: { agentId: string, name: string, oldStatus?: string, status: string, timestamp: string }) => {
            // Prepend new update
            setStatusUpdates(prev => [{
                id: Math.random().toString(36).substr(2, 9),
                ...data
            }, ...prev].slice(0, 50)); // Keep the latest 50 updates

            // Update agents list
            setAgents(prevAgents => prevAgents.map(agent =>
                agent.agentId === data.agentId ? { ...agent, status: data.status } : agent
            ));

            // Sync top metrics
            fetchMetrics();
        };

        const handleTicketActivity = () => {
            fetchAgents(true); // Silent background table refresh
            fetchMetrics(); // Make sure top tiles sync as well
        };

        socket.on('agentStatusUpdated', handleStatusUpdate);
        socket.on('ticketAssigned', handleTicketActivity);
        socket.on('ticketApprovalRequested', handleTicketActivity);
        socket.on('ticketResolved', handleTicketActivity);
        socket.on('ticketRejected', handleTicketActivity);

        return () => {
            socket.off('agentStatusUpdated', handleStatusUpdate);
            socket.off('ticketAssigned', handleTicketActivity);
            socket.off('ticketApprovalRequested', handleTicketActivity);
            socket.off('ticketResolved', handleTicketActivity);
            socket.off('ticketRejected', handleTicketActivity);
            socket.disconnect();
        };
    }, []);

    // Debounce search query
    useEffect(() => {
        setIsSearching(true);
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 300);

        return () => {
            clearTimeout(timer);
        };
    }, [searchQuery]);

    // Reset page to 1 when search query changes
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchQuery]);

    const MetricCard = ({ title, value, colorClass, icon }: any) => (
        <div className="bg-[var(--bg-card)] p-6 rounded-xl shadow-[var(--shadow-sm)] border border-[var(--border-primary)] flex items-center gap-4 cursor-default transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-md)]">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${colorClass}`}>
                {icon}
            </div>
            <div className="flex flex-col">
                <span className="text-2xl font-bold text-[var(--text-primary)]">{value}</span>
                <span className="text-sm text-[var(--text-secondary)] font-medium">{title}</span>
            </div>
        </div>
    );

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

    if (isLoading) {
        return <div className="p-8 text-center text-[var(--text-muted)] italic flex-1 flex items-center justify-center">Loading agents pool...</div>;
    }

    return (
        <div className="flex flex-col gap-6 overflow-y-auto p-6">

            {/* Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <MetricCard title="Total Agents" value={metrics.total} colorClass="bg-[var(--bg-tertiary)] text-[var(--accent-primary)]" icon="👥" />
                <MetricCard title="Available Agents" value={metrics.available} colorClass="bg-[var(--status-active-bg)] text-[var(--status-active-color)]" icon="✓" />
                <MetricCard title="On Break" value={metrics.break} colorClass="bg-[var(--status-pending-bg)] text-[var(--status-pending-color)]" icon="☕" />
                <MetricCard title="Offline" value={metrics.offline} colorClass="bg-[var(--bg-tertiary)] text-[var(--text-muted)]" icon="🔌" />
                <MetricCard title="Busy" value={metrics.busy} colorClass="bg-[var(--status-resolving-bg)] text-[var(--status-resolving-color)]" icon="⚡" />
            </div>

            {/* Search */}
            <div className="relative max-w-xl">
                <input
                    type="text"
                    placeholder="Search agents by name, ID, or status..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full py-3 px-4 pl-11 border border-[var(--border-secondary)] rounded-lg text-[0.95rem] outline-none transition-all focus:border-[var(--accent-primary)] focus:ring-4 focus:ring-[var(--accent-primary)]/10 bg-[var(--bg-card)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] shadow-[var(--shadow-sm)]"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                    {isSearching ? (
                        <svg className="animate-spin h-5 w-5 text-[var(--accent-primary)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : "🔍"}
                </span>
            </div>

            {/* Main Layout containing status updates (mock) and table */}
            <div className="flex gap-6 mt-2 items-start">
                {/* Left Mini Panel */}
                <div className="w-[300px] bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-primary)] flex flex-col min-h-[500px] max-h-[600px]">
                    <div className="px-5 py-4 border-b border-[var(--border-secondary)] flex justify-between items-center bg-[var(--bg-tertiary)] rounded-t-xl shrink-0">
                        <h2 className="text-[1.05rem] font-bold text-[var(--text-primary)] m-0">Status Updates</h2>
                        {statusUpdates.length > 0 && (
                            <button
                                onClick={() => setStatusUpdates([])}
                                className="text-xs bg-transparent border border-[var(--border-secondary)] px-2 py-1 rounded text-[var(--text-secondary)] hover:text-red-500 hover:border-red-500 transition-colors cursor-pointer"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                    {statusUpdates.length === 0 ? (
                        <div className="p-6 flex-1 flex items-center justify-center text-[var(--text-muted)] text-sm text-center italic bg-[var(--bg-secondary)]">
                            No recent status updates
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-[var(--bg-secondary)]">
                            {statusUpdates.map(update => (
                                <div key={update.id} className="shrink-0 bg-[var(--bg-card)] border border-[var(--border-secondary)] p-4 rounded-lg shadow-sm text-sm animate-fade-in-down flex flex-col gap-2 relative overflow-hidden group">
                                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${getStatusDot(update.status)}`}></div>
                                    <div className="flex justify-between items-start ml-2">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-semibold text-[var(--text-primary)]">{update.name}</span>
                                            <span className="text-[0.7rem] text-[var(--text-muted)] font-mono">{update.agentId}</span>
                                        </div>
                                        <span className="text-xs text-[var(--text-muted)] font-medium bg-[var(--bg-tertiary)] px-2 py-1 rounded-full border border-[var(--border-secondary)]">
                                            {new Date(update.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 ml-2">
                                        {update.oldStatus && update.oldStatus !== update.status && (
                                            <>
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${getStatusStyle(update.oldStatus)} opacity-75`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(update.oldStatus)}`}></span>
                                                    {update.oldStatus}
                                                </span>
                                                <span className="text-[var(--text-muted)] font-semibold text-xs">➔</span>
                                            </>
                                        )}
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${getStatusStyle(update.status)}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(update.status)}`}></span>
                                            {update.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right Table Panel */}
                <div className="flex-1 bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-primary)] flex flex-col min-h-[500px]">
                    <div className="px-6 py-4 border-b border-[var(--border-secondary)] flex justify-between items-center bg-[var(--bg-tertiary)] rounded-t-xl">
                        <h2 className="text-[1.05rem] font-bold text-[var(--text-primary)] m-0">All Agents</h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-[var(--border-secondary)] bg-[var(--bg-card)]">
                                    <th className="px-6 py-4 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Agent</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">ID</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider text-center">Pending Tickets</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider text-center">Resolved Tickets</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider text-center">Pending Approvals</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-primary)] relative">
                                {isLoading && agents.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-[var(--text-muted)] italic">
                                            Loading agents...
                                        </td>
                                    </tr>
                                ) : (
                                    <>
                                        {/* Optional background overlay while searching or fetching */}
                                        {(isSearching || isFetching) && !isLoading && (
                                            <tr className="absolute inset-0 bg-[var(--bg-card)]/40 z-10 transition-opacity pointer-events-none backdrop-blur-[1px]"></tr>
                                        )}
                                        {agents.length > 0 ? (
                                            agents.map(agent => (
                                                <tr
                                                    key={agent.agentId}
                                                    className="hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer"
                                                    onClick={() => {
                                                        setSelectedAgent(agent);
                                                        setIsModalOpen(true);
                                                    }}
                                                >
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 rounded-full bg-[var(--bg-tertiary)] text-[var(--accent-primary)] flex items-center justify-center font-bold text-sm">
                                                                {agent.name.charAt(0)}
                                                            </div>
                                                            <span className="font-semibold text-[var(--text-primary)]">{agent.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 font-mono text-sm text-[var(--text-secondary)]">{agent.agentId}</td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${getStatusStyle(agent.status)}`}>
                                                            <span className={`w-2 h-2 rounded-full ${getStatusDot(agent.status)}`}></span>
                                                            {agent.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center font-medium text-[var(--text-primary)]">{agent.totalPending || 0}</td>
                                                    <td className="px-6 py-4 text-center font-medium text-[var(--text-primary)]">{agent.totalResolved || 0}</td>
                                                    <td className="px-6 py-4 text-center font-medium text-[var(--text-primary)]">{agent.pendingApprovals || 0}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <button
                                                            className="p-2 text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 rounded-lg transition-colors bg-transparent border-none cursor-pointer"
                                                            title="View Details"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedAgent(agent);
                                                                setIsModalOpen(true);
                                                            }}
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                            </svg>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={7} className="px-6 py-12 text-center text-[var(--text-muted)] italic">
                                                    No agents matched your search.
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    {!isLoading && totalPages > 1 && (
                        <div className="px-6 py-4 border-t border-[var(--border-secondary)] bg-[var(--bg-tertiary)] flex items-center justify-between rounded-b-xl">
                            <span className="text-sm text-[var(--text-secondary)]">
                                Page <span className="font-semibold text-[var(--text-primary)]">{currentPage}</span> of <span className="font-semibold text-[var(--text-primary)]">{totalPages}</span>
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1 || isFetching}
                                    className="px-4 py-2 text-sm font-medium text-[var(--text-primary)] bg-[var(--bg-card)] border border-[var(--border-secondary)] rounded-lg hover:bg-[var(--bg-secondary)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 transition-all"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages || isFetching}
                                    className="px-4 py-2 text-sm font-medium text-[var(--text-primary)] bg-[var(--bg-card)] border border-[var(--border-secondary)] rounded-lg hover:bg-[var(--bg-secondary)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 transition-all"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Agent Details Modal */}
            <AgentDetailsModal
                isOpen={isModalOpen}
                agent={selectedAgent}
                onClose={() => {
                    setIsModalOpen(false);
                    setSelectedAgent(null);
                }}
            />
        </div>
    );
}
