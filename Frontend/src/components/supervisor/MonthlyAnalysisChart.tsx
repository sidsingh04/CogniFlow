import { useState, useEffect } from 'react';
import axiosInstance from '../../utils/axiosInstance';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import socket from '../../services/socket';

export default function MonthlyAnalysisChart() {
    const [availableMonths, setAvailableMonths] = useState<string[]>([]);
    const [selectedMonth, setSelectedMonth] = useState<string>('');
    const [chartData, setChartData] = useState<any[]>([]);

    useEffect(() => {
        const fetchMonths = async () => {
            try {
                const res = await axiosInstance.get('/api/analytics/available-months');
                if (res.data.success) {
                    const months = res.data.availableMonths;
                    setAvailableMonths(months);
                    if (months.length > 0) {
                        setSelectedMonth(months[0]);
                    } else {
                        const now = new Date();
                        setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
                    }
                }
            } catch (error) {
                console.error("Failed to load available months", error);
            }
        };
        fetchMonths();
    }, []);

    const fetchMonthlyData = async () => {
        if (!selectedMonth) return;
        try {
            const res = await axiosInstance.get(`/api/analytics/monthly-data?month=${selectedMonth}`);
            if (res.data.success) {
                setChartData(res.data.days);
            }
        } catch (error) {
            console.error("Failed to load monthly data", error);
        }
    };

    useEffect(() => {
        fetchMonthlyData();
    }, [selectedMonth]);

    // Live Socket Sync for Chart Bars
    useEffect(() => {
        const handleChartUpdate = () => {
            fetchMonthlyData();
        };

        socket.on('ticketCreated', handleChartUpdate);
        socket.on('ticketResolved', handleChartUpdate);

        return () => {
            socket.off('ticketCreated', handleChartUpdate);
            socket.off('ticketResolved', handleChartUpdate);
        };
    }, [selectedMonth]);

    const formatMonthLabel = (monthString: string) => {
        if (!monthString) return '';
        const parts = monthString.split('-');
        if (parts.length < 2) return monthString;
        const [year, month] = parts;
        const d = new Date(parseInt(year), parseInt(month) - 1, 1);
        if (isNaN(d.getTime())) return monthString;
        return d.toLocaleDateString('default', { month: 'long', year: 'numeric' });
    };

    return (
        <div className="bg-[var(--bg-card)] p-6 rounded-xl shadow-[var(--shadow-sm)] border border-[var(--border-primary)] flex flex-col w-full h-full min-h-[450px]">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-[var(--text-primary)] m-0">Monthly Analysis (Day-wise)</h3>
                <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="py-2 px-4 border border-[var(--border-secondary)] rounded-lg text-sm bg-[var(--bg-primary)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20 transition-all font-medium cursor-pointer"
                >
                    {availableMonths.length === 0 && <option value={selectedMonth}>{formatMonthLabel(selectedMonth) || 'Loading...'}</option>}
                    {availableMonths.map(m => (
                        <option key={m} value={m}>{formatMonthLabel(m)}</option>
                    ))}
                </select>
            </div>

            <div className="w-full h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-secondary)" />
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} tickMargin={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} allowDecimals={false} tickMargin={10} />
                        <Tooltip
                            cursor={{ fill: 'var(--bg-secondary)' }}
                            contentStyle={{
                                backgroundColor: 'var(--bg-tertiary)',
                                borderRadius: '8px',
                                border: '1px solid var(--border-primary)',
                                boxShadow: 'var(--shadow-md)',
                                color: 'var(--text-primary)'
                            }}
                            labelFormatter={(label) => `Day ${label}, ${formatMonthLabel(selectedMonth)}`}
                        />
                        <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ paddingBottom: '20px' }} />
                        <Bar name="Tickets Raised" dataKey="raised" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} maxBarSize={30} />
                        <Bar name="Tickets Resolved" dataKey="resolved" fill="var(--status-active-color)" radius={[4, 4, 0, 0]} maxBarSize={30} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
