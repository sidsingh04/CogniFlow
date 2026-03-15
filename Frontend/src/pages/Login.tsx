import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance, { setAccessToken } from '../utils/axiosInstance';

type Role = 'Agent' | 'Supervisor';

export default function Login() {
    const navigate = useNavigate();
    const [role, setRole] = useState<Role>('Agent');
    const [userId, setUserId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        console.log(`Logging in as ${role} with ID: ${userId}`);

        if (role === 'Agent') {
            try {
                const response = await axiosInstance.post("/api/login/agent", {
                    userId,
                    password
                });

                if (response.status === 200) {
                    console.log(`Agent ${userId} login Successfully`);

                    const { token } = response.data;
                    if (token) {
                        setAccessToken(token);
                    }

                    sessionStorage.setItem("isAuthenticated", "true");
                    sessionStorage.setItem("userId", userId);
                    sessionStorage.setItem("Privelege", "agent");
                    sessionStorage.setItem("agentId", userId);
                    // sessionStorage.setItem("agent", );
                    navigate('/agent');
                }
            } catch (error) {
                console.error("Login failed", error);
                setError('Invalid credentials');
            }
        } else {
            try {
                const response = await axiosInstance.post("/api/login/supervisor", {
                    userId,
                    password
                });

                if (response.status === 200 && response.data.success) {
                    console.log(`Supervisor ${userId} login Successfully`);

                    const { token } = response.data;
                    if (token) {
                        setAccessToken(token);
                    }

                    sessionStorage.setItem("isAuthenticated", "true");
                    sessionStorage.setItem("userId", userId);
                    sessionStorage.setItem("Privelege", "supervisor");
                    sessionStorage.setItem("supervisorId", userId);
                    navigate('/supervisor');
                } else {
                    console.error('Invalid Supervisor credentials');
                    setError('Invalid credentials');
                }
            } catch (error) {
                console.error("Login failed", error);
                setError('Invalid credentials');
            }
        }
    };

    const isAgent = role === 'Agent';

    return (
        <div className="min-h-screen flex items-center p-5 justify-center bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] font-sans">
            <div className="bg-white rounded-[20px] shadow-[0_20px_60px_rgba(0,0,0,0.3)] w-full max-w-[420px] overflow-hidden">

                {/* Header */}
                <div className="px-[30px] pt-[30px] pb-[20px] text-center">
                    <h1 className="text-[1.8rem] text-[#1a1a2e] mb-2 font-bold leading-tight">CogniFlow Portal</h1>
                    <p className="text-[#666] text-[0.95rem]">Sign in to your account</p>
                </div>

                {/* Mode Switcher */}
                <div className="flex mx-[30px] bg-[#f0f2f5] rounded-xl p-[5px] relative">
                    {/* Animated Slider */}
                    <div
                        className={`absolute top-[5px] left-[5px] w-[calc(50%-5px)] h-[calc(100%-10px)] rounded-[10px] transition-all duration-300 ease-in-out ${isAgent
                            ? 'bg-[linear-gradient(135deg,#667eea_0%,#764ba2_100%)] translate-x-0'
                            : 'bg-[linear-gradient(135deg,#11998e_0%,#38ef7d_100%)] translate-x-full'
                            }`}
                    />

                    <button
                        type="button"
                        onClick={() => setRole('Agent')}
                        className={`flex-1 py-3 px-5 border-none bg-transparent text-[0.95rem] font-semibold cursor-pointer rounded-lg transition-all duration-300 z-10 ${isAgent ? 'text-white' : 'text-[#666]'
                            }`}
                    >
                        Agent
                    </button>
                    <button
                        type="button"
                        onClick={() => setRole('Supervisor')}
                        className={`flex-1 py-3 px-5 border-none bg-transparent text-[0.95rem] font-semibold cursor-pointer rounded-lg transition-all duration-300 z-10 ${!isAgent ? 'text-white' : 'text-[#666]'
                            }`}
                    >
                        Supervisor
                    </button>
                </div>

                {/* Login Form */}
                <form onSubmit={handleLogin} className="p-[30px]">
                    <div className="mb-5 text-left">
                        <label className="block mb-2 font-semibold text-[#333] text-[0.9rem]" htmlFor="userId">
                            User ID
                        </label>
                        <input
                            type="text"
                            id="userId"
                            name="userId"
                            placeholder="Enter your user ID"
                            required
                            value={userId}
                            onChange={(e) => setUserId(e.target.value)}
                            className={`w-full py-3.5 px-4 border-2 border-[#e0e0e0] bg-white text-black rounded-xl text-base transition-all duration-300 outline-none ${isAgent
                                ? 'focus:ring-4 focus:ring-[#667eea]/10 focus:border-[#667eea]'
                                : 'focus:ring-4 focus:ring-[#11998e]/10 focus:border-[#11998e]'
                                }`}
                        />
                    </div>

                    <div className="mb-5 text-left">
                        <label className="block mb-2 font-semibold text-[#333] text-[0.9rem]" htmlFor="password">
                            Password
                        </label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            placeholder="Enter your password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={`w-full py-3.5 px-4 border-2 border-[#e0e0e0] bg-white text-black rounded-xl text-base transition-all duration-300 outline-none ${isAgent
                                ? 'focus:ring-4 focus:ring-[#667eea]/10 focus:border-[#667eea]'
                                : 'focus:ring-4 focus:ring-[#11998e]/10 focus:border-[#11998e]'
                                }`}
                        />
                    </div>

                    {error && (
                        <div className="text-red-500 text-[0.9rem] font-medium text-center mb-4 bg-red-50 py-2 rounded-lg border border-red-100">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className={`w-full p-3.5 border-none rounded-[10px] text-[1rem] font-semibold text-white cursor-pointer transition-all duration-300 mt-2.5 hover:-translate-y-0.5 hover:shadow-[0_8px_25px_rgba(0,0,0,0.2)] active:translate-y-0 ${isAgent
                            ? 'bg-[linear-gradient(135deg,#667eea_0%,#764ba2_100%)]'
                            : 'bg-[linear-gradient(135deg,#11998e_0%,#38ef7d_100%)]'
                            }`}
                    >
                        Sign In
                    </button>
                </form>

                {/* Role Indicator */}
                <div className="text-center p-[15px] bg-[#f8f9fa] text-[0.85rem] text-[#666]">
                    Signing in as <span className={`font-semibold ${isAgent ? 'text-[#667eea]' : 'text-[#11998e]'}`}>{role}</span>
                </div>
            </div>
        </div>
    );
}
