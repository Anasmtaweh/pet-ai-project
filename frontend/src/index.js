import React from 'react';
import ReactDOM from 'react-dom/client'; // For interacting with the DOM in React 18+.
import App from './App'; // The root component of the application.
import 'bootstrap/dist/css/bootstrap.min.css'; // Imports Bootstrap CSS for styling.
import './index.css'; // Imports global custom styles for the application.

// Ensures that the React application is rendered after the entire page (including all resources) has loaded.
window.onload = () => {
  // Creates a root for the React application, targeting the 'root' div in public/index.html.
  const root = ReactDOM.createRoot(document.getElementById('root'));
  // Renders the main App component within React's StrictMode for highlighting potential problems.
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};
