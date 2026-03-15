
interface SupervisorTopBarProps {
    supervisor: any;
}

export default function SupervisorTopBar({ supervisor }: SupervisorTopBarProps) {
    const initials = supervisor?.name?.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'SV';

    return (
        <header className="bg-[var(--bg-secondary)] flex justify-between items-center border-b border-[var(--border-primary)] shadow-[var(--shadow-sm)] h-[70px]">
            <div className="flex items-center gap-4">
                <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600 m-0 pl-6">CogniFlow</h3>
                <span className="px-3 py-1 bg-[var(--bg-primary)] text-[var(--accent-primary)] rounded-full text-xs font-semibold tracking-wide uppercase border border-[var(--border-secondary)]">
                    Supervisor
                </span>
            </div>

            <div className="flex items-center gap-4 mr-6">
                <div className="flex items-center gap-3">
                    <div className="flex flex-col text-right">
                        <span className="font-semibold text-[0.95rem] text-[var(--text-primary)]">{supervisor?.name || 'Loading...'}</span>
                        <span className="text-xs text-[var(--text-muted)]">ID: {supervisor?.supervisorId || '...'}</span>
                    </div>
                    <div className="w-10 h-10 bg-purple-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                        {initials}
                    </div>
                </div>
            </div>
        </header>
    );
}
