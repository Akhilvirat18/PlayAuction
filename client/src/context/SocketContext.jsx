import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext();

export const useSocket = () => {
    return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        // Connect to the backend server
        const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:5050', {
            transports: ['polling', 'websocket'],
            reconnectionAttempts: 5,
            timeout: 10000
        });

        newSocket.on('connect', () => {
            console.log('✅ Socket connected:', newSocket.id);
        });

        newSocket.on('connect_error', (err) => {
            console.error('❌ Socket connection error:', err.message);
        });
        setSocket(newSocket);

        return () => newSocket.close();
    }, []);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};
