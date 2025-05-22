import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
// Importing page components for routing.
import Login from './pages/Login';
import Signup from './pages/Signup';
import PetProfile from './pages/PetProfile';
import ProtectedRoute from './components/ProtectedRoute'; // Component for route protection.
import PetForm from './pages/PetForm';
import AIChat from './pages/AIChat';
import Scheduler from './pages/Scheduler';
import EditPet from './pages/EditPet';
import AdminDashboard from './admin/AdminDashboard';
import AdminLogin from './admin/AdminLogin';
import AdminUserManagement from './admin/AdminUserManagement';
import AdminPetManagement from './admin/AdminPetManagement';
import AdminSettings from './admin/AdminSettings';
import UserSettings from './pages/UserSettings';
// Importing shared layout components.
import Header from './components/Header';
import Footer from './components/Footer';
// Importing pages for password reset functionality.
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';


// Main App component that defines the application's structure and routing.
function App() {
    return (
        // BrowserRouter enables client-side routing for the application.
        <BrowserRouter>
            {/* Header component is rendered on all pages. */}
            <Header />
            {/* Routes component defines the different navigation paths and their corresponding components. */}
            <Routes>
                {/* Publicly accessible routes. */}
                <Route path="/" element={<Login />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password/:token" element={<ResetPassword />} />
                <Route path="/admin/login" element={<AdminLogin />} />

                {/* Protected routes for regular authenticated users. */}
                {/* The ProtectedRoute component will handle authentication checks. */}
                <Route element={<ProtectedRoute />}>
                    <Route path="/petprofile" element={<PetProfile />} />
                    <Route path="/petform" element={<PetForm />} />
                    <Route path="/aichat" element={<AIChat />} />
                    <Route path="/scheduler" element={<Scheduler />} />
                    <Route path="/editpet/:petId" element={<EditPet />} />
                    <Route path="/usersettings" element={<UserSettings />} />
                </Route>

                {/* Protected routes specifically for admin users. */}
                {/* The ProtectedRoute component with `isAdminRoute={true}` handles admin role checks. */}
                <Route element={<ProtectedRoute isAdminRoute={true} />}>
                    <Route path="/admin/dashboard" element={<AdminDashboard />} />
                    <Route path="/admin/users" element={<AdminUserManagement />} />
                    <Route path="/admin/pets" element={<AdminPetManagement />} />
                    <Route path="/admin/settings" element={<AdminSettings />} />
                </Route>
            </Routes>
            {/* Footer component is rendered on all pages. */}
            <Footer />
        </BrowserRouter>
    );
}

export default App;

