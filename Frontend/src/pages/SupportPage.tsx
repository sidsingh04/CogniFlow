import React from 'react';
import { useNavigate } from 'react-router-dom';
import SupportChatButton from '../components/support/SupportChatButton';

const SupportPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f4f6f8', fontFamily: 'Inter, sans-serif' }}>
            {/* Header Navbar */}
            <header
                style={{
                    backgroundColor: '#003366',
                    padding: '16px 40px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }}
            >
                <div>
                    <h1 style={{ color: 'white', margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
                        CogniFlow Support
                    </h1>
                </div>
                <div>
                    <button
                        onClick={() => navigate('/')}
                        style={{
                            backgroundColor: 'transparent',
                            color: 'white',
                            border: '1px solid white',
                            padding: '8px 16px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '500',
                            transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'white';
                            e.currentTarget.style.color = '#003366';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = 'white';
                        }}
                    >
                        Back to Home
                    </button>
                </div>
            </header>

            {/* Hero Section */}
            <section
                style={{
                    padding: '60px 20px',
                    textAlign: 'center',
                    backgroundColor: '#0055a4',
                    color: 'white',
                }}
            >
                <h2 style={{ fontSize: '40px', margin: '0 0 16px 0', fontWeight: '700' }}>
                    How can we help you today?
                </h2>
                <p style={{ fontSize: '18px', maxWidth: '600px', margin: '0 auto', opacity: 0.9 }}>
                    Search our knowledge base or chat with our AI Support Assistant for instant solutions to your problems.
                </p>
            </section>

            {/* Main Content Area */}
            <main
                style={{
                    maxWidth: '1200px',
                    margin: '-40px auto 40px auto',
                    padding: '0 20px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '24px',
                }}
            >
                {/* Knowledge Base Cards */}
                <div style={cardStyle}>
                    <div style={iconStyle}>📖</div>
                    <h3 style={cardTitleStyle}>Knowledge Base</h3>
                    <p style={cardTextStyle}>
                        Browse our extensive collection of articles, tutorials, and step-by-step guides.
                    </p>
                    <a href="#" style={linkStyle}>Browse Articles &rarr;</a>
                </div>

                <div style={cardStyle}>
                    <div style={iconStyle}>🔑</div>
                    <h3 style={cardTitleStyle}>Account Issues</h3>
                    <p style={cardTextStyle}>
                        Having trouble logging in? Find resources to reset passwords and unlock your account.
                    </p>
                    <a href="#" style={linkStyle}>Get Account Help &rarr;</a>
                </div>

                <div style={cardStyle}>
                    <div style={iconStyle}>⚙️</div>
                    <h3 style={cardTitleStyle}>System Status</h3>
                    <p style={cardTextStyle}>
                        Check the real-time status of CogniFlow services and scheduled maintenance.
                    </p>
                    <a href="#" style={linkStyle}>View Status Page &rarr;</a>
                </div>
            </main>

            {/* The Floating Chat Widget */}
            <SupportChatButton />
        </div>
    );
};

// --- Styles ---
const cardStyle: React.CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '32px 24px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
    borderTop: '4px solid #007bff',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    transition: 'transform 0.2s',
};

const iconStyle: React.CSSProperties = {
    fontSize: '32px',
    marginBottom: '16px',
};

const cardTitleStyle: React.CSSProperties = {
    margin: '0 0 12px 0',
    fontSize: '20px',
    fontWeight: '600',
    color: '#333',
};

const cardTextStyle: React.CSSProperties = {
    margin: '0 0 24px 0',
    fontSize: '15px',
    color: '#666',
    flex: 1,
    lineHeight: 1.5,
};

const linkStyle: React.CSSProperties = {
    color: '#007bff',
    textDecoration: 'none',
    fontWeight: '500',
    fontSize: '15px',
};

export default SupportPage;
