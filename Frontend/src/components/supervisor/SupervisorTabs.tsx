import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance, { setAccessToken } from '../../utils/axiosInstance';
import TicketsTab from './TicketsTab';
import AgentsTab from './AgentsTab';
import AnalyticsTab from './AnalyticsTab';
import SlaAnalyticsTab from './SlaAnalyticsTab';
import ApprovalTab from './ApprovalTab';

interface SupervisorTabsProps {
    supervisor?: any;
}

export default function SupervisorTabs({ supervisor }: SupervisorTabsProps) {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'tickets' | 'approval' | 'agents' | 'analytics' | 'slaAnalytics'>('tickets');

    const handleSignOut = async () => {
        if (window.confirm('Are you sure you want to sign out?')) {
            try {
                await axiosInstance.post('/api/login/logout');
            } catch (e) {
                console.error("Logout API call failed", e);
            }
            setAccessToken(null);
            sessionStorage.clear();
            navigate('/');
        }
    };

    return (
        <div className="flex-1 flex overflow-hidden w-full h-full pb-4">
            {/* Left Sidebar Navigation */}
            <div className="w-[220px] shrink-0 flex flex-col justify-between border-r border-[#e5e7eb] px-4 h-full pb-4">
                <div className="flex flex-col gap-2 pt-2">
                    <button
                        onClick={() => setActiveTab('tickets')}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all font-medium text-sm cursor-pointer ${activeTab === 'tickets'
                            ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] font-bold'
                            : 'text-[var(--text-secondary)] hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-[var(--bg-tertiary)] dark:hover:text-white'
                            }`}
                    >
                        <span>Tickets</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('approval')}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all font-medium text-sm cursor-pointer ${activeTab === 'approval'
                            ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] font-bold'
                            : 'text-[var(--text-secondary)] hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-[var(--bg-tertiary)] dark:hover:text-white'
                            }`}
                    >
                        <span>Approval</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('agents')}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all font-medium text-sm cursor-pointer ${activeTab === 'agents'
                            ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] font-bold'
                            : 'text-[var(--text-secondary)] hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-[var(--bg-tertiary)] dark:hover:text-white'
                            }`}
                    >
                        <span>Agents</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('analytics')}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all font-medium text-sm cursor-pointer ${activeTab === 'analytics'
                            ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] font-bold'
                            : 'text-[var(--text-secondary)] hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-[var(--bg-tertiary)] dark:hover:text-white'
                            }`}
                    >
                        <span>Analytics</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('slaAnalytics')}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all font-medium text-sm cursor-pointer ${activeTab === 'slaAnalytics'
                            ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] font-bold'
                            : 'text-[var(--text-secondary)] hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-[var(--bg-tertiary)] dark:hover:text-white'
                            }`}
                    >
                        <span>SLA Analytics</span>
                    </button>
                </div>

                {/* Bottom Sign Out Container */}
                <div className="mt-auto flex justify-center w-full">
                    <button
                        onClick={handleSignOut}
                        className="w-[90%] flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 border border-red-200 rounded-xl cursor-pointer text-sm font-semibold transition-all hover:bg-red-600 hover:text-white hover:border-red-600 shadow-sm"
                    >
                        <span>Sign Out</span>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto pr-2 pb-4 pt-2 flex flex-col gap-6 w-full max-w-[1400px] mx-auto">
                {activeTab === 'tickets' && <TicketsTab />}
                {activeTab === 'approval' && <ApprovalTab />}
                {activeTab === 'agents' && <AgentsTab />}
                {activeTab === 'analytics' && <AnalyticsTab />}
                {activeTab === 'slaAnalytics' && <SlaAnalyticsTab />}
            </div>
        </div>
    );
}
