import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
export const LoginPage = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const submit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await onLogin(username, password);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsx("main", { className: "layout center", children: _jsxs("form", { className: "card login", onSubmit: submit, children: [_jsx("h1", { children: "FieldOps Asset Dashboard" }), _jsx("p", { children: "Sign in with your assigned account." }), error && _jsx("p", { className: "error", children: error }), _jsxs("label", { children: ["Username", _jsx("input", { type: "text", required: true, value: username, onChange: (e) => setUsername(e.target.value) })] }), _jsxs("label", { children: ["Password", _jsx("input", { type: "password", required: true, value: password, onChange: (e) => setPassword(e.target.value) })] }), _jsx("button", { type: "submit", disabled: loading, children: loading ? 'Signing in...' : 'Sign In' })] }) }));
};
