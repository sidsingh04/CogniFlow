import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AgentTopBar from '../components/agent/AgentTopBar';
import AgentTabs from '../components/agent/AgentTabs';
import AgentNotifications from '../components/agent/AgentNotifications';
import TicketDetailsModal from '../components/agent/TicketDetailsModal';
import { initializeTheme } from '../theme/Theme';
import socket from '../services/socket';

export default function AgentDashboard() {
    const navigate = useNavigate();
    const [agent, setAgent] = useState<any>(null);
    const [tickets, setTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTicket, setSelectedTicket] = useState<any>(null);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(true);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [historyRefreshId, setHistoryRefreshId] = useState(0);

    const loadDashboardData = async () => {
        try {
            const userId = sessionStorage.getItem('userId');
            if (!userId) {
                navigate('/');
                return;
            }

            const agentRes = await axios.get(`http://localhost:3000/api/agent/get-agent?agentId=${userId}`);
            let currentAgent = agentRes.data.agent;

            const ticketsRes = await axios.get(`http://localhost:3000/api/ticket/get-by-agentId?agentId=${userId}`);
            const currentTickets = ticketsRes.data.success ? ticketsRes.data.tickets : [];
            setTickets(currentTickets);

            if (currentAgent.totalPending === 0 && currentAgent.status !== 'Break') {
                currentAgent.status = 'Available';
            } else if (currentAgent.totalPending > 0 && currentAgent.status !== 'Break') {
                currentAgent.status = 'Busy';
            }

            await axios.post('http://localhost:3000/api/agent/update-status', {
                agentId: userId,
                status: currentAgent.status
            });

            setAgent(currentAgent);
            setLoading(false);
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            setLoading(false);
        }
    };

    useEffect(() => {
        initializeTheme();
        loadDashboardData();
    }, [navigate]);

    useEffect(() => {
        const userId = sessionStorage.getItem('userId');
        if (!userId) return;

        socket.connect();

        const handleTicketAssigned = (data: { ticket: any, agentId: string, timestamp: string }) => {
            if (data.agentId === userId) {
                // Add ticket to the view list
                setTickets(prev => [data.ticket, ...prev]);

                // Update local agent counts
                setAgent((prevAgent: any) => {
                    if (!prevAgent) return prevAgent;
                    const updatedTotalPending = (prevAgent.totalPending || 0) + 1;
                    return {
                        ...prevAgent,
                        totalPending: updatedTotalPending,
                        status: (prevAgent.status === 'Available' && updatedTotalPending > 0) ? 'Busy' : prevAgent.status
                    };
                });

                // Trigger a silent history refetch in AgentTabs
                setHistoryRefreshId(prev => prev + 1);

                // Add notification to the side panel
                setNotifications(prev => [{
                    id: data.ticket.issueId + '-' + Date.now(),
                    message: `Ticket with ID ${data.ticket.issueId} has been assigned to you.`,
                    timestamp: data.timestamp,
                    type: 'assigned'
                }, ...prev]);
            }
        };

        const handleTicketApprovalSent = (data: { ticket: any, agentId: string, timestamp: string }) => {
            if (data.agentId === userId) {
                setHistoryRefreshId(prev => prev + 1);

                // Update live tickets to change status to 'approval'
                setTickets(prev => prev.map(t =>
                    t.issueId === data.ticket.issueId ? { ...t, status: 'approval', approvalDate: data.ticket.approvalDate } : t
                ));

                // Update local agent counts
                setAgent((prevAgent: any) => {
                    if (!prevAgent) return prevAgent;
                    const updatedPending = Math.max(0, (prevAgent.totalPending || 0) - 1);
                    return {
                        ...prevAgent,
                        pendingApprovals: (prevAgent.pendingApprovals || 0) + 1,
                        totalPending: updatedPending,
                        status: (updatedPending === 0 && prevAgent.status === 'Busy') ? 'Available' : prevAgent.status,
                        totalCallDuration: (prevAgent.totalCallDuration || 0) + (data.ticket.callDuration || 0)
                    };
                });

                setNotifications(prev => [{
                    id: 'approval-sent-' + data.ticket.issueId + '-' + Date.now(),
                    message: `Approval request for ticket ${data.ticket.issueId} sent to supervisor.`,
                    timestamp: data.timestamp,
                    type: 'assigned' // Standard blue/yellow style
                }, ...prev]);
            }
        };

        const handleTicketResolved = (data: { ticket: any, agentId: string, timestamp: string }) => {
            if (data.agentId === userId) {
                setHistoryRefreshId(prev => prev + 1);

                // Update live tickets to change status to 'resolved'
                setTickets(prev => prev.map(t =>
                    t.issueId === data.ticket.issueId ? { ...t, status: 'resolved', resolvedDate: data.ticket.resolvedDate } : t
                ));

                // Update local agent counts
                setAgent((prevAgent: any) => {
                    if (!prevAgent) return prevAgent;
                    return {
                        ...prevAgent,
                        totalResolved: (prevAgent.totalResolved || 0) + 1,
                        pendingApprovals: Math.max(0, (prevAgent.pendingApprovals || 0) - 1),
                        successfulCalls: (prevAgent.successfulCalls || 0) + 1
                    };
                });

                setNotifications(prev => [{
                    id: 'resolved-' + data.ticket.issueId + '-' + Date.now(),
                    message: `Ticket ${data.ticket.issueId} has been approved and marked as resolved.`,
                    timestamp: data.timestamp,
                    type: 'resolved'
                }, ...prev]);
            }
        };

        const handleTicketRejected = (data: { ticket: any, agentId: string, timestamp: string }) => {
            if (data.agentId === userId) {
                setHistoryRefreshId(prev => prev + 1);

                // Update live tickets to revert to 'pending'
                setTickets(prev => prev.map(t =>
                    t.issueId === data.ticket.issueId ? { ...t, status: 'pending', approvalDate: null } : t
                ));

                // Update local agent counts
                setAgent((prevAgent: any) => {
                    if (!prevAgent) return prevAgent;
                    const updatedTotalPending = (prevAgent.totalPending || 0) + 1;
                    return {
                        ...prevAgent,
                        totalPending: updatedTotalPending,
                        pendingApprovals: Math.max(0, (prevAgent.pendingApprovals || 0) - 1),
                        failedCalls: (prevAgent.failedCalls || 0) + 1,
                        status: (prevAgent.status === 'Available' && updatedTotalPending > 0) ? 'Busy' : prevAgent.status
                    };
                });

                setNotifications(prev => [{
                    id: 'rejected-' + data.ticket.issueId + '-' + Date.now(),
                    message: `Approval for ticket ${data.ticket.issueId} has been rejected by supervisor.`,
                    timestamp: data.timestamp,
                    type: 'rejected'
                }, ...prev]);
            }
        };

        const handleForceLogout = (data: { agentId: string, timestamp: string }) => {
            if (data.agentId === userId) {
                alert('You have been logged out by a supervisor.');
                sessionStorage.clear();
                socket.disconnect();
                navigate('/');
            }
        };

        socket.on('ticketAssigned', handleTicketAssigned);
        socket.on('ticketApprovalSent', handleTicketApprovalSent);
        socket.on('ticketResolved', handleTicketResolved);
        socket.on('ticketRejected', handleTicketRejected);
        socket.on('forceLogout', handleForceLogout);

        return () => {
            socket.off('ticketAssigned', handleTicketAssigned);
            socket.off('ticketApprovalSent', handleTicketApprovalSent);
            socket.off('ticketResolved', handleTicketResolved);
            socket.off('ticketRejected', handleTicketRejected);
            socket.off('forceLogout', handleForceLogout);
            socket.disconnect();
        };
    }, []);

    if (loading || !agent) {
        return (
            <div className="h-screen flex items-center justify-center bg-[var(--bg-primary)]">
                <div className="text-[var(--text-muted)] font-medium">Loading Agent Dashboard...</div>
            </div>
        );
    }

    return (
        <div className="h-screen bg-[var(--bg-primary)] flex flex-col font-sans text-[var(--text-primary)] overflow-hidden">
            <AgentTopBar
                agent={agent}
                setAgent={setAgent}
            />
            <main className="flex flex-1 overflow-hidden pt-6">
                <AgentTabs
                    agent={agent}
                    tickets={tickets}
                    onTicketClick={(ticket: any) => setSelectedTicket(ticket)}
                    historyRefreshId={historyRefreshId}
                />
                <AgentNotifications
                    isOpen={isNotificationsOpen}
                    onToggle={() => setIsNotificationsOpen(!isNotificationsOpen)}
                    notifications={notifications}
                    onClear={() => setNotifications([])}
                />
            </main>

            <TicketDetailsModal
                isOpen={!!selectedTicket}
                ticket={selectedTicket}
                agent={agent}
                onClose={() => setSelectedTicket(null)}
                onTicketUpdate={loadDashboardData}
            />
        </div>
    );
}
