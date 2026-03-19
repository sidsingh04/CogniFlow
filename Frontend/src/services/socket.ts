import { io, Socket } from 'socket.io-client';

const socket: Socket = io(import.meta.env.VITE_API_BASE_URL as string, {
    autoConnect: false, // We connect explicitly in components that need it
});

export default socket;
