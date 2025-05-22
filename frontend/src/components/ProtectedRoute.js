import React from 'react';
import { Navigate, Outlet } from 'react-router-dom'; // For navigation and rendering child routes.

// ProtectedRoute component to control access to routes based on authentication and role.
// It takes an optional `isAdminRoute` prop to differentiate between admin-only and user-only routes.
function ProtectedRoute({ isAdminRoute }) {
    // Retrieves the authentication token from local storage.
    const token = localStorage.getItem('token');

    // If no token exists, the user is not authenticated.
    // Redirects to the login page ('/').
    if (!token) {
        return <Navigate to="/" />;
    }

    try {
        // Decodes the JWT payload to get user information, specifically the role.
        const decodedToken = JSON.parse(atob(token.split('.')[1]));
        const role = decodedToken.role;

        // Role-based access control if `isAdminRoute` prop is provided.
        if (isAdminRoute !== undefined) {
            // If the route is an admin route but the user is not an admin,
            // redirect to the user's pet profile page.
            if (isAdminRoute && role !== 'admin') {
                return <Navigate to="/petprofile" />;
            }
            // If the route is a user route but the user is an admin,
            // redirect to the admin dashboard.
            if (!isAdminRoute && role === 'admin') {
                return <Navigate to="/admin/dashboard" />;
            }
        }
        // If token decoding fails (e.g., invalid token),
        // log the error and redirect to the login page.
    } catch (error) {
        console.error('Error decoding token:', error);
        return <Navigate to="/" />;
    }

    // If the user is authenticated and has the correct role (or if role check is not applicable),
    // render the child routes using the <Outlet /> component.
    return <Outlet />;
}

export default ProtectedRoute;

