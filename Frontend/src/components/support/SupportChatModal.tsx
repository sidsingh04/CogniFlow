import React, { useState, useRef, useEffect } from 'react';
import axiosInstance from '../../utils/axiosInstance';

interface SupportChatModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ChatMessage {
    sender: 'user' | 'ai';
    text: string | React.ReactNode;
}

const FeedbackButtons: React.FC<{ documentId: string }> = ({ documentId }) => {
    const [voted, setVoted] = useState<boolean>(false);
    const [statusText, setStatusText] = useState<string>('');
    const [hoverUp, setHoverUp] = useState<boolean>(false);
    const [hoverDown, setHoverDown] = useState<boolean>(false);

    const handleVote = async (action: 'upvote' | 'downvote') => {
        if (voted) return;
        setVoted(true);
        try {
            await axiosInstance.put(`/api/knowledge/feedback-kb/${documentId}`, { action });
            setStatusText('Thanks for the feedback!');
        } catch (e) {
            console.error(e);
            setStatusText('Feedback failed.');
            setVoted(false);
        }
    };

    return (
        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px' }}>
            <span style={{ color: '#555' }}>Was this helpful?</span>
            <button
                onClick={() => handleVote('upvote')}
                disabled={voted}
                onMouseEnter={() => setHoverUp(true)}
                onMouseLeave={() => setHoverUp(false)}
                style={{
                    background: hoverUp && !voted ? '#e6ffe6' : 'transparent',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    cursor: voted ? 'not-allowed' : 'pointer',
                    padding: '2px 6px',
                    opacity: voted ? 0.5 : 1,
                    transition: 'background-color 0.2s'
                }}
            >👍</button>
            <button
                onClick={() => handleVote('downvote')}
                disabled={voted}
                onMouseEnter={() => setHoverDown(true)}
                onMouseLeave={() => setHoverDown(false)}
                style={{
                    background: hoverDown && !voted ? '#ffe6e6' : 'transparent',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    cursor: voted ? 'not-allowed' : 'pointer',
                    padding: '2px 6px',
                    opacity: voted ? 0.5 : 1,
                    transition: 'background-color 0.2s'
                }}
            >👎</button>
            {statusText && <span style={{ color: '#28a745', fontStyle: 'italic', marginLeft: 'auto' }}>{statusText}</span>}
        </div>
    );
};

const getConfidenceColor = (score: number) => {
    if (score > 0.75) return '#006400';
    if (score >= 0.60) return '#4caf50';
    return '#9acd32';
};

const SupportChatModal: React.FC<SupportChatModalProps> = ({ isOpen, onClose }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([
        { sender: 'ai', text: 'Hello! I am CogniFlow Support Bot. How can I assist you today?' }
    ]);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        } else {
            setMessages([{ sender: 'ai', text: 'Hello! I am CogniFlow Support Bot. How can I assist you today?' }]);
            setTitle('');
            setDescription('');
        }
    }, [messages, isOpen]);

    const handleSendMessage = async () => {
        if (!title.trim() || !description.trim()) return;

        const formattedMessage = `Title: ${title}\nDescription: ${description}`;
        const newUserMsg: ChatMessage = { sender: 'user', text: formattedMessage };
        setMessages((prev) => [...prev, newUserMsg]);
        setTitle('');
        setDescription('');
        setIsLoading(true);

        try {
            const { data } = await axiosInstance.post('/api/knowledge/search-kb', { title, description });

            let responseContent: React.ReactNode;

            if (data.solutions && data.solutions.length > 0) {
                const topScore = data.solutions[0].confidenceScore;
                const introText = topScore > 0.75
                    ? "Thanks for reaching out! We found some solutions that might help you:"
                    : "These are the articles that might help you:";

                responseContent = (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div>{introText}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {data.solutions.map((sol: any, i: number) => (
                                <div key={i} style={{
                                    backgroundColor: 'white',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    border: '1px solid #ccc',
                                    fontSize: '13px'
                                }}>
                                    <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#0055a4' }}>
                                        {sol.title} <span style={{ fontSize: '11px', color: getConfidenceColor(sol.confidenceScore), fontWeight: 'bold' }}>({Math.round(sol.confidenceScore * 100)}% match)</span>
                                    </div>
                                    <div style={{ color: '#333', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                                        {Array.isArray(sol.solution) ? sol.solution.map((text: string, idx: number) => (
                                            <div key={idx} style={{ padding: '8px', backgroundColor: '#f9f9f9', borderRadius: '4px', borderLeft: '3px solid #0055a4' }}>
                                                {text}
                                            </div>
                                        )) : (
                                            <div style={{ padding: '8px', backgroundColor: '#f9f9f9', borderRadius: '4px', borderLeft: '3px solid #0055a4' }}>
                                                {sol.solution}
                                            </div>
                                        )}
                                    </div>
                                    <FeedbackButtons documentId={sol._id} />
                                </div>
                            ))}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666', fontStyle: 'italic', marginTop: '4px' }}>
                            If the issue is still not resolved then this is our helpline number for the support-team: 1-800-CogniFlow
                        </div>
                    </div>
                );
            } else {
                responseContent = `Sorry we cannot find a solution for your issue in our knowledge base and here is our contact number for the support-team: 1-800-CogniFlow`;
            }

            setMessages((prev) => [...prev, { sender: 'ai', text: responseContent }]);
        } catch (error) {
            console.error('Error sending message:', error);
            setMessages((prev) => [...prev, { sender: 'ai', text: 'Sorry, I encountered an error. Please try again later.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            style={{
                position: 'fixed',
                bottom: '90px',
                right: '24px',
                width: '450px',
                height: '500px',
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                zIndex: 1000,
                border: '1px solid #e0e0e0',
                fontFamily: 'sans-serif'
            }}
        >
            {/* Header */}
            <div
                style={{
                    backgroundColor: '#007bff',
                    color: 'white',
                    padding: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid #e0e0e0',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>🤖</span>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>CogniFlow Support Bot</h3>
                </div>
                <button
                    onClick={onClose}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'white',
                        fontSize: '18px',
                        cursor: 'pointer',
                        padding: '4px',
                    }}
                >
                    ✖
                </button>
            </div>

            {/* Chat Area */}
            <div
                style={{
                    flex: 1,
                    padding: '16px',
                    overflowY: 'auto',
                    backgroundColor: '#f8f9fa',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                }}
            >
                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        style={{
                            alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                            backgroundColor: msg.sender === 'user' ? '#007bff' : '#e9ecef',
                            color: msg.sender === 'user' ? 'white' : '#212529',
                            padding: '10px 14px',
                            borderRadius: '18px',
                            borderBottomRightRadius: msg.sender === 'user' ? '4px' : '18px',
                            borderBottomLeftRadius: msg.sender === 'ai' ? '4px' : '18px',
                            maxWidth: '80%',
                            fontSize: '14px',
                            lineHeight: '1.4',
                            whiteSpace: 'pre-wrap',
                        }}
                    >
                        {msg.text}
                    </div>
                ))}
                {isLoading && (
                    <div style={{ alignSelf: 'flex-start', color: '#6c757d', fontSize: '13px', fontStyle: 'italic', paddingLeft: '8px' }}>
                        AI is typing...
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div
                style={{
                    padding: '16px',
                    backgroundColor: '#ffffff',
                    borderTop: '1px solid #e0e0e0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                }}
            >
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Query Title..."
                    style={{
                        padding: '10px 14px',
                        border: '1px solid #ccc',
                        borderRadius: '8px',
                        outline: 'none',
                        fontSize: '14px',
                    }}
                />
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Query Description..."
                    rows={3}
                    style={{
                        padding: '10px 14px',
                        border: '1px solid #ccc',
                        borderRadius: '8px',
                        outline: 'none',
                        fontSize: '14px',
                        resize: 'none',
                    }}
                />
                <button
                    onClick={handleSendMessage}
                    disabled={isLoading || !title.trim() || !description.trim()}
                    style={{
                        backgroundColor: (title.trim() && description.trim() && !isLoading) ? '#007bff' : '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '10px 16px',
                        cursor: (title.trim() && description.trim() && !isLoading) ? 'pointer' : 'not-allowed',
                        fontWeight: 'bold',
                        transition: 'background-color 0.2s',
                        alignSelf: 'flex-end',
                        marginTop: '4px'
                    }}
                >
                    Submit Query
                </button>
            </div>
        </div>
    );
};

export default SupportChatModal;
