import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { useAuth0 } from "@auth0/auth0-react";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth0();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user?.email) return;

    const socket = io(`${process.env.REACT_APP_URL}/collab`, {
      transports: ["websocket", "polling"],
      withCredentials: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on("connect", () => {
      setConnected(true);
      // Join personal notification room keyed on email
      socket.emit("identify", { email: user.email });
    });

    socket.on("disconnect", () => setConnected(false));

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [isAuthenticated, user?.email]);

  const joinChat = useCallback((chatId) => {
    socketRef.current?.emit("join_chat", { chatId });
  }, []);

  const leaveChat = useCallback((chatId) => {
    socketRef.current?.emit("leave_chat", { chatId });
  }, []);

  const sendTyping = useCallback((chatId, senderName) => {
    socketRef.current?.emit("typing", { chatId, senderName });
  }, []);

  const sendStopTyping = useCallback((chatId) => {
    socketRef.current?.emit("stop_typing", { chatId });
  }, []);

  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  }, []);

  const off = useCallback((event, handler) => {
    socketRef.current?.off(event, handler);
  }, []);

  return (
    <SocketContext.Provider value={{ socket: socketRef, connected, joinChat, leaveChat, sendTyping, sendStopTyping, on, off }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
