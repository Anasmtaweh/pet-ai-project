import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Container from 'react-bootstrap/Container';
import Table from 'react-bootstrap/Table';
import styles from './AdminDashboard.module.css';
import { FaUser, FaDog } from 'react-icons/fa'; // Import icons

function AdminDashboard() {
    useEffect(() => {
        document.title = "MISHTIKA - Admin Dashboard";
    }, []);

    const [dashboardData, setDashboardData] = useState(null);
    const [error, setError] = useState('');
    const token = localStorage.getItem('token');

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const response = await axios.get('http://localhost:3001/admin/dashboard', {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });
                setDashboardData(response.data);
            } catch (err) {
                console.error('Error fetching dashboard data:', err);
                setError(err.response?.data?.message || 'An error occurred while fetching dashboard data.');
            }
        };

        fetchDashboardData();
    }, [token]);

    if (error) {
        return (
            <Container className="mt-5">
                <div className="alert alert-danger">{error}</div>
            </Container>
        );
    }

    if (!dashboardData) {
        return (
            <Container className="mt-5">
                <p>Loading dashboard data...</p>
            </Container>
        );
    }

    return (
        <Container className={styles.dashboardContainer}>
            <h1 className={styles.dashboardTitle}>Admin Dashboard</h1>
            <Table striped bordered hover className={styles.dashboardTable}>
                <tbody>
                    <tr className={styles.tableRow}>
                        <td className={styles.tableData}>
                            <FaUser className={styles.tableIcon} />
                            <span className={styles.tableDataText}>Total Users</span>
                        </td>
                        <td className={styles.tableData}>{dashboardData.totalUsers}</td>
                    </tr>
                    <tr className={styles.tableRow}>
                        <td className={styles.tableData}>
                            <FaDog className={styles.tableIcon} />
                            <span className={styles.tableDataText}>Total Pets</span>
                        </td>
                        <td className={styles.tableData}>{dashboardData.totalPets}</td>
                    </tr>
                    <tr>
                        <td className={styles.tableData}>Active Users</td>
                        <td className={styles.tableData}>{dashboardData.activeUsers}</td>
                    </tr>
                </tbody>
            </Table>
         
          
          <h2 className={styles.recentActivityTitle}>Recent Activity</h2>
          <table className={styles.recentActivityTable}>
              <thead>
                  <tr>
                      <th>Type</th>
                      <th>Details</th>
                      <th>Timestamp</th>
                  </tr>
              </thead>
              <tbody>
                  {dashboardData.recentActivity.map((activity, index) => (
                      <tr key={index}>
                          <td><span className={styles.recentActivityType}>{activity.type}</span></td>
                          <td>{activity.details}</td>
                          <td><span className={styles.recentActivityTimestamp}>{new Date(activity.timestamp).toLocaleString()}</span></td>
                      </tr>
                  ))}
              </tbody>
          </table>
          
       
          

        </Container>
    );
}

export default AdminDashboard;