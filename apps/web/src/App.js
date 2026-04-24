import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { apiClient } from './api/client';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
const tokenStorageKey = 'hartsystem_token';
export const App = () => {
    const [token, setToken] = useState(localStorage.getItem(tokenStorageKey));
    const [user, setUser] = useState(null);
    const [booting, setBooting] = useState(true);
    useEffect(() => {
        apiClient.setToken(token);
        if (!token) {
            setBooting(false);
            return;
        }
        apiClient
            .getMe()
            .then((me) => setUser(me))
            .catch(() => {
            localStorage.removeItem(tokenStorageKey);
            setToken(null);
            setUser(null);
        })
            .finally(() => setBooting(false));
    }, [token]);
    const handleLogin = async (username, password) => {
        const response = await apiClient.login(username, password);
        apiClient.setToken(response.token);
        localStorage.setItem(tokenStorageKey, response.token);
        setToken(response.token);
        setUser(response.user);
    };
    const handleLogout = () => {
        localStorage.removeItem(tokenStorageKey);
        setUser(null);
        setToken(null);
        apiClient.setToken(null);
    };
    if (booting) {
        return _jsx("main", { className: "layout center", children: _jsx("p", { children: "Loading..." }) });
    }
    if (!token || !user) {
        return _jsx(LoginPage, { onLogin: handleLogin });
    }
    return _jsx(DashboardPage, { user: user, onLogout: handleLogout });
};
