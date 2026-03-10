import React, { useState, useRef, useEffect } from 'react';

interface SupportChatModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ChatMessage {
    sender: 'user' | 'ai';
    text: string;
}

const SupportChatModal: React.FC<SupportChatModalProps> = ({ isOpen, onClose }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([
        { sender: 'ai', text: 'Hello! I am OmniSync Support AI. How can I assist you today?' }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen]);

    const handleSendMessage = async () => {
        if (!inputValue.trim()) return;

        const newUserMsg: ChatMessage = { sender: 'user', text: inputValue };
        setMessages((prev) => [...prev, newUserMsg]);
        setInputValue('');
        setIsLoading(true);

        // TODO: Replace with actual backend logic
        try {
            // Simulate a short network delay
            await new Promise((resolve) => setTimeout(resolve, 1000));

            const aiResponseMsg: ChatMessage = { sender: 'ai', text: 'Thanks for reaching out! We are currently working on connecting me to the brain. Please check back later.' };
            setMessages((prev) => [...prev, aiResponseMsg]);
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
                width: '350px',
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
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>OmniSync Support AI</h3>
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
                    gap: '8px',
                }}
            >
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={(e) => {
                        if (e.key === 'Enter') handleSendMessage();
                    }}
                    placeholder="Type your message..."
                    style={{
                        flex: 1,
                        padding: '10px 14px',
                        border: '1px solid #ccc',
                        borderRadius: '24px',
                        outline: 'none',
                        fontSize: '14px',
                    }}
                />
                <button
                    onClick={handleSendMessage}
                    disabled={isLoading || !inputValue.trim()}
                    style={{
                        backgroundColor: inputValue.trim() && !isLoading ? '#007bff' : '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '24px',
                        padding: '0 16px',
                        cursor: inputValue.trim() && !isLoading ? 'pointer' : 'not-allowed',
                        fontWeight: 'bold',
                        transition: 'background-color 0.2s',
                    }}
                >
                    Send
                </button>
            </div>
        </div>
    );
};

export default SupportChatModal;
