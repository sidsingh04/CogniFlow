import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SupervisorTopBar from '../components/supervisor/SupervisorTopBar';
import SupervisorTabs from '../components/supervisor/SupervisorTabs';
import { initializeTheme } from '../theme/Theme';

export default function SupervisorDashboard() {
    const navigate = useNavigate();
    const [supervisor, setSupervisor] = useState<any>(null);

    useEffect(() => {
        initializeTheme();
        const fetchSupervisor = async () => {
            const supervisorId = sessionStorage.getItem('supervisorId');
            if (!supervisorId) {
                navigate('/');
                return;
            }
            try {
                // Adjusting the endpoint to match backend if available or just setting dummy data/state
                setSupervisor({ name: `Supervisor ${supervisorId}`, supervisorId });
            } catch (error) {
                console.error("Failed to load supervisor data:", error);
                navigate('/');
            }
        };
        fetchSupervisor();
    }, [navigate]);

    if (!supervisor) {
        return <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] text-[var(--text-muted)]">Loading supervisor data...</div>;
    }

    return (
        <div className="h-screen bg-[var(--bg-primary)] flex flex-col font-sans text-[var(--text-primary)] overflow-hidden">
            <SupervisorTopBar supervisor={supervisor} />
            <main className="flex flex-1 overflow-hidden pt-6">
                <SupervisorTabs supervisor={supervisor} />
            </main>
        </div>
    );
}
