import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

function ProtectedRoute({ isAdminRoute }) {
    const token = localStorage.getItem('token');

    if (!token) {
        return <Navigate to="/" />;
    }

    try {
        const decodedToken = JSON.parse(atob(token.split('.')[1]));
        const role = decodedToken.role;

        if (isAdminRoute !== undefined) {
            if (isAdminRoute && role !== 'admin') {
                return <Navigate to="/petprofile" />;
            }
            if (!isAdminRoute && role === 'admin') {
                return <Navigate to="/admin/dashboard" />;
            }
        }
    } catch (error) {
        console.error('Error decoding token:', error);
        return <Navigate to="/" />;
    }

    return <Outlet />;
}

export default ProtectedRoute;
