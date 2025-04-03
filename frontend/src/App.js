import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import PetProfile from './pages/PetProfile';
import ProtectedRoute from './components/ProtectedRoute';
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
import Header from './components/Header'; // Import Header
import Footer from './components/Footer'; // Import Footer
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import SearchPage from './pages/Search';


function App() {
    return (
        <BrowserRouter>
            <Header /> {/* Render Header */}
            <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password/:token" element={<ResetPassword />} />
                <Route path="/admin/login" element={<AdminLogin />} />

                {/* Protected routes for regular users */}
                <Route element={<ProtectedRoute />}>
                    <Route path="/petprofile" element={<PetProfile />} />
                    <Route path="/petform" element={<PetForm />} />
                    <Route path="/search" element={<SearchPage />} />
                    <Route path="/aichat" element={<AIChat />} />
                    <Route path="/scheduler" element={<Scheduler />} />
                    <Route path="/editpet/:petId" element={<EditPet />} />
                    <Route path="/usersettings" element={<UserSettings />} />
                </Route>

                {/* Protected route for admins */}
                <Route element={<ProtectedRoute isAdminRoute={true} />}>
                    <Route path="/admin/dashboard" element={<AdminDashboard />} />
                    <Route path="/admin/users" element={<AdminUserManagement />} />
                    <Route path="/admin/pets" element={<AdminPetManagement />} />
                    <Route path="/admin/settings" element={<AdminSettings />} />
                </Route>
            </Routes>
            <Footer /> {/* Render Footer */}
        </BrowserRouter>
    );
}

export default App;
