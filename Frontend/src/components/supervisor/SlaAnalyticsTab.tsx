import { useState, useEffect } from 'react';
import axios from 'axios';
import socket from '../../services/socket';
import BreachedAgentTicketsModal from './BreachedAgentTicketsModal';

interface SlaMetrics {
    totalBreaches: number;
    totalAgentsWithBreaches: number;
    percentOfAgentsWithBreaches: number;
    percentOfTicketsWithBreaches: number;
    averageResolutionHours: number;
}

interface BreachedTicket {
    issueId: string;
    code: string;
    agentId: string;
    issueDate: string;
    slaDeadline: string;
    status: string;
}

interface BreachedAgent {
    agentId: string;
    incidentsCount: number;
    averageResolutionHours: number;
}

export default function SlaAnalyticsTab() {
    const [metrics, setMetrics] = useState<SlaMetrics>({
        totalBreaches: 0,
        totalAgentsWithBreaches: 0,
        percentOfAgentsWithBreaches: 0,
        percentOfTicketsWithBreaches: 0,
        averageResolutionHours: 0
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isScanning, setIsScanning] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    // Sub-tab toggles
    const [activeSubTab, setActiveSubTab] = useState<'tickets' | 'agents'>('tickets');
    const [breachedTickets, setBreachedTickets] = useState<BreachedTicket[]>([]);
    const [breachedAgents, setBreachedAgents] = useState<BreachedAgent[]>([]);

    // Pagination specific state
    const [ticketsPage, setTicketsPage] = useState(1);
    const [ticketsTotalPages, setTicketsTotalPages] = useState(1);
    const [agentsPage, setAgentsPage] = useState(1);
    const [agentsTotalPages, setAgentsTotalPages] = useState(1);

    // Modal state
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchMetrics = async (isBackgroundLoad = false) => {
        if (!isBackgroundLoad) setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            const res = await axios.get('http://localhost:3000/api/sla/dashboard-metrics', { headers });

            if (res.data.success) {
                setMetrics(res.data.data);
            }
            setLastUpdated(new Date());
        } catch (error) {
            console.error("Failed to load SLA dashboard metrics", error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchBreachedTickets = async (page = 1) => {
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            const res = await axios.get(`http://localhost:3000/api/sla/breached-tickets?page=${page}&limit=10`, { headers });

            if (res.data.success) {
                setBreachedTickets(res.data.data);
                if (res.data.pagination) {
                    setTicketsTotalPages(res.data.pagination.totalPages);
                }
            }
        } catch (error) {
            console.error("Failed to load fetched Breached Tickets limit", error);
        }
    };

    const fetchBreachedAgents = async (page = 1) => {
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            const res = await axios.get(`http://localhost:3000/api/sla/breached-agents?page=${page}&limit=10`, { headers });

            if (res.data.success) {
                setBreachedAgents(res.data.data);
                if (res.data.pagination) {
                    setAgentsTotalPages(res.data.pagination.totalPages);
                }
            }
        } catch (error) {
            console.error("Failed to load fetched Breached Agents limit", error);
        }
    };

    const handleScanBreaches = async () => {
        setIsScanning(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('http://localhost:3000/api/sla/scan-breaches', {}, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (res.data.success) {
                // Refresh metrics after scanning
                await fetchMetrics(true);
            }
        } catch (error) {
            console.error("Failed to scan SLA breaches", error);
        } finally {
            setIsScanning(false);
        }
    };

    useEffect(() => {
        fetchMetrics();
        fetchBreachedTickets(ticketsPage);
        fetchBreachedAgents(agentsPage);

        // Socket listener for live metrics updates
        const handleTicketActivity = () => {
            fetchMetrics(true);
            fetchBreachedTickets(ticketsPage);
            fetchBreachedAgents(agentsPage);
        };

        socket.on('ticketCreated', handleTicketActivity);
        socket.on('ticketAssigned', handleTicketActivity);
        socket.on('ticketResolved', handleTicketActivity);

        return () => {
            socket.off('ticketCreated', handleTicketActivity);
            socket.off('ticketAssigned', handleTicketActivity);
            socket.off('ticketResolved', handleTicketActivity);
        };
    }, []);

    useEffect(() => {
        fetchBreachedTickets(ticketsPage);
    }, [ticketsPage]);

    useEffect(() => {
        fetchBreachedAgents(agentsPage);
    }, [agentsPage]);

    const MetricCard = ({ title, value, icon, colorClass, subtitle }: any) => (
        <div className="bg-[var(--bg-card)] p-6 rounded-xl shadow-[var(--shadow-sm)] border border-[var(--border-primary)] flex items-center justify-between transition-shadow hover:shadow-[var(--shadow-md)]">
            <div>
                <div className="text-3xl font-bold text-[var(--text-primary)] mb-1 flex items-baseline gap-2">
                    {value}
                    {subtitle && <span className="text-sm font-normal text-[var(--text-muted)]">{subtitle}</span>}
                </div>
                <div className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">{title}</div>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl shrink-0 ${colorClass}`}>
                {icon}
            </div>
        </div>
    );

    const handleViewAgentTickets = (agentId: string) => {
        setSelectedAgentId(agentId);
        setIsModalOpen(true);
    };

    if (isLoading) {
        return <div className="p-8 text-center text-[var(--text-muted)] italic flex-1 flex items-center justify-center">Loading SLA Analytics dashboard...</div>;
    }

    return (
        <div className="flex flex-col gap-6 w-full p-6 pb-12">

            <div className="flex justify-between items-center mb-2">
                <div>
                    <h2 className="text-2xl font-bold text-[var(--text-primary)]">SLA Performance Overview</h2>
                    <p className="text-sm text-[var(--text-muted)] mt-1">
                        Last updated: {lastUpdated.toLocaleTimeString()}
                    </p>
                </div>
                <button
                    onClick={handleScanBreaches}
                    disabled={isScanning}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm"
                >
                    {isScanning ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Scanning...
                        </>
                    ) : (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                            </svg>
                            Scan & Refresh
                        </>
                    )}
                </button>
            </div>

            {/* Top Cards - 3 Columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricCard
                    title="Total SLA Breaches"
                    value={metrics.totalBreaches}
                    icon={
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    }
                    colorClass="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                />
                <MetricCard
                    title="Agents with Breaches"
                    value={metrics.totalAgentsWithBreaches}
                    icon={
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                        </svg>
                    }
                    colorClass="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
                />
                <MetricCard
                    title="Average Resolution Time"
                    value={metrics.averageResolutionHours}
                    subtitle="hours"
                    icon={
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    }
                    colorClass="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                />
            </div>

            {/* Bottom Cards - 2 Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <MetricCard
                    title="Tickets Breached"
                    value={`${metrics.percentOfTicketsWithBreaches}%`}
                    icon={
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
                        </svg>
                    }
                    colorClass="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                />
                <MetricCard
                    title="Agents Breached"
                    value={`${metrics.percentOfAgentsWithBreaches}%`}
                    icon={
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11.412 15.655L9.75 21.75l3.745-4.012M9.257 13.5H3.75l2.659-2.849m2.048-2.194L14.25 2.25 12 10.5h8.25l-4.707 5.043M8.457 8.457L3 3m5.457 5.457l7.086 7.086m0 0L21 21" />
                        </svg>
                    }
                    colorClass="bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400"
                />
            </div>

            {/* Toggle Tabs */}
            <div className="flex border-b border-[var(--border-secondary)] mt-4">
                <button
                    className={`px-6 py-3 font-semibold text-sm outline-none transition-colors border-b-2 ${activeSubTab === 'tickets' ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}
                    onClick={() => setActiveSubTab('tickets')}
                >
                    Breached Tickets
                </button>
                <button
                    className={`px-6 py-3 font-semibold text-sm outline-none transition-colors border-b-2 ${activeSubTab === 'agents' ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}
                    onClick={() => setActiveSubTab('agents')}
                >
                    Breached Agents
                </button>
            </div>

            {/* Table Area */}
            {activeSubTab === 'tickets' && (
                breachedTickets.length > 0 ? (
                    <div className="bg-[var(--bg-card)] rounded-xl shadow-[var(--shadow-sm)] border border-[var(--border-primary)] overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-[var(--bg-secondary)] border-b border-[var(--border-secondary)]">
                                        <th className="p-4 font-semibold text-sm text-[var(--text-secondary)] whitespace-nowrap">Ticket ID</th>
                                        <th className="p-4 font-semibold text-sm text-[var(--text-secondary)] whitespace-nowrap">Code</th>
                                        <th className="p-4 font-semibold text-sm text-[var(--text-secondary)] whitespace-nowrap">Agent ID</th>
                                        <th className="p-4 font-semibold text-sm text-[var(--text-secondary)] whitespace-nowrap">Issue Time</th>
                                        <th className="p-4 font-semibold text-sm text-[var(--text-secondary)] whitespace-nowrap">SLA Breached Time</th>
                                        <th className="p-4 font-semibold text-sm text-[var(--text-secondary)] whitespace-nowrap">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {breachedTickets.map((ticket, idx) => (
                                        <tr key={`${ticket.issueId}-${idx}`} className="border-b border-[var(--border-secondary)] hover:bg-[var(--bg-secondary)] transition-colors">
                                            <td className="p-4 font-medium text-[var(--text-primary)] whitespace-nowrap">
                                                {ticket.issueId}
                                            </td>
                                            <td className="p-4">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-secondary)]">
                                                    {ticket.code}
                                                </span>
                                            </td>
                                            <td className="p-4 text-[var(--text-secondary)] whitespace-nowrap">
                                                {ticket.agentId}
                                            </td>
                                            <td className="p-4 text-[var(--text-secondary)] whitespace-nowrap">
                                                {new Date(ticket.issueDate).toLocaleString()}
                                            </td>
                                            <td className="p-4 text-red-600 dark:text-red-400 font-medium whitespace-nowrap">
                                                {ticket.slaDeadline ? new Date(ticket.slaDeadline).toLocaleString() : 'N/A'}
                                            </td>
                                            <td className="p-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border ${ticket.status === 'resolved'
                                                    ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
                                                    : ticket.status === 'approval'
                                                        ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800'
                                                        : 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800'
                                                    }`}>
                                                    {ticket.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Controls for Tickets */}
                        {ticketsTotalPages > 1 && (
                            <div className="px-5 py-3 border-t border-[var(--border-secondary)] bg-[var(--bg-tertiary)] flex justify-between items-center shrink-0">
                                <span className="text-xs text-[var(--text-secondary)]">
                                    Page {ticketsPage} of {ticketsTotalPages}
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        disabled={ticketsPage === 1}
                                        onClick={() => setTicketsPage(p => p - 1)}
                                        className="px-3 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border-secondary)] text-[var(--text-primary)] text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--bg-secondary)] transition-colors"
                                    >
                                        Previous
                                    </button>
                                    <button
                                        disabled={ticketsPage === ticketsTotalPages}
                                        onClick={() => setTicketsPage(p => p + 1)}
                                        className="px-3 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border-secondary)] text-[var(--text-primary)] text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--bg-secondary)] transition-colors"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-[var(--bg-secondary)] p-8 rounded-xl border border-[var(--border-secondary)] flex flex-col justify-center items-center text-center">
                        <div className="w-16 h-16 bg-[var(--bg-tertiary)] rounded-full flex items-center justify-center text-green-500 mb-4 border border-[var(--border-primary)] shadow-[var(--shadow-sm)]">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">No SLA Breached Tickets</h3>
                        <p className="text-[var(--text-muted)] max-w-md">
                            All tickets are currently within their designated Service Level Agreements. Great job!
                        </p>
                    </div>
                )
            )
            }

            {
                activeSubTab === 'agents' && (
                    breachedAgents.length > 0 ? (
                        <div className="bg-[var(--bg-card)] rounded-xl shadow-[var(--shadow-sm)] border border-[var(--border-primary)] overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-[var(--bg-secondary)] border-b border-[var(--border-secondary)]">
                                            <th className="p-4 font-semibold text-sm text-[var(--text-secondary)] whitespace-nowrap">Agent ID</th>
                                            <th className="p-4 font-semibold text-sm text-[var(--text-secondary)] whitespace-nowrap">SLA Breach Incidents</th>
                                            <th className="p-4 font-semibold text-sm text-[var(--text-secondary)] whitespace-nowrap">Avg Ticket Resolution Time</th>
                                            <th className="p-4 font-semibold text-sm text-[var(--text-secondary)] whitespace-nowrap text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {breachedAgents.map((agent, idx) => (
                                            <tr key={`${agent.agentId}-${idx}`} className="border-b border-[var(--border-secondary)] hover:bg-[var(--bg-secondary)] transition-colors">
                                                <td className="p-4 font-bold text-[var(--text-primary)] whitespace-nowrap">
                                                    {agent.agentId}
                                                </td>
                                                <td className="p-4">
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
                                                        {agent.incidentsCount} Incidents
                                                    </span>
                                                </td>
                                                <td className="p-4 text-[var(--text-secondary)] whitespace-nowrap">
                                                    <span className="font-medium text-[var(--text-primary)]">{agent.averageResolutionHours}</span> hours
                                                </td>
                                                <td className="p-4 whitespace-nowrap text-right">
                                                    <button
                                                        onClick={() => handleViewAgentTickets(agent.agentId)}
                                                        className="px-3 py-1.5 text-sm bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--accent-primary)] hover:text-white hover:border-[var(--accent-primary)] transition-colors shadow-sm"
                                                    >
                                                        View Tickets
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Controls for Agents */}
                            {agentsTotalPages > 1 && (
                                <div className="px-5 py-3 border-t border-[var(--border-secondary)] bg-[var(--bg-tertiary)] flex justify-between items-center shrink-0">
                                    <span className="text-xs text-[var(--text-secondary)]">
                                        Page {agentsPage} of {agentsTotalPages}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            disabled={agentsPage === 1}
                                            onClick={() => setAgentsPage(p => p - 1)}
                                            className="px-3 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border-secondary)] text-[var(--text-primary)] text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--bg-secondary)] transition-colors"
                                        >
                                            Previous
                                        </button>
                                        <button
                                            disabled={agentsPage === agentsTotalPages}
                                            onClick={() => setAgentsPage(p => p + 1)}
                                            className="px-3 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border-secondary)] text-[var(--text-primary)] text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--bg-secondary)] transition-colors"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-[var(--bg-secondary)] p-8 rounded-xl border border-[var(--border-secondary)] flex flex-col justify-center items-center text-center">
                            <div className="w-16 h-16 bg-[var(--bg-tertiary)] rounded-full flex items-center justify-center text-blue-500 mb-4 border border-[var(--border-primary)] shadow-[var(--shadow-sm)]">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">No SLA Breached Agents</h3>
                            <p className="text-[var(--text-muted)] max-w-md">
                                No agents currently have active SLA breaches. Everyone is fulfilling their resolution targets on time!
                            </p>
                        </div>
                    )
                )
            }

            <BreachedAgentTicketsModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                agentId={selectedAgentId || ''}
                tickets={breachedTickets.filter(t => t.agentId === selectedAgentId)}
            />

        </div >
    );
}
