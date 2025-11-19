import React, { useState, useRef, useEffect } from 'react';
import { createChatSession } from '../services/geminiService';
import type { Chat } from '@google/genai';
import { BotIcon, UserIcon, SendIcon, SpinnerIcon, XCircleIcon } from './icons';

interface EndpointChatProps {
    context: string;
    initialMessage?: string;
    onClose?: () => void;
}

export const EndpointChat: React.FC<EndpointChatProps> = ({ context, initialMessage, onClose }) => {
    const [chat, setChat] = useState<Chat | null>(null);
    const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [chatError, setChatError] = useState<string | null>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const hasInitialized = useRef(false);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatHistory, isChatLoading]);

    useEffect(() => {
        if (!hasInitialized.current && context) {
            try {
                const newChat = createChatSession(context);
                setChat(newChat);
                hasInitialized.current = true;
                
                if (initialMessage) {
                    handleSendMessage(initialMessage, newChat);
                }
            } catch (err) {
                setChatError("Failed to initialize chat session.");
            }
        }
    }, [context, initialMessage]);

    const handleSendMessage = async (message: string, currentChat: Chat | null = chat) => {
        if (!message.trim() || !currentChat) return;

        setChatHistory(prev => [...prev, { role: 'user', text: message }]);
        setIsChatLoading(true);
        setChatError(null);

        try {
            const responseStream = await currentChat.sendMessageStream({ message });
            
            setChatHistory(prev => [...prev, { role: 'model', text: '' }]);

            for await (const chunk of responseStream) {
                const chunkText = chunk.text;
                setChatHistory(prev => {
                    const newHistory = [...prev];
                    const lastMsg = newHistory[newHistory.length - 1];
                    if (lastMsg.role === 'model') {
                        lastMsg.text += chunkText;
                    }
                    return newHistory;
                });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
            setChatError(errorMessage);
            setChatHistory(prev => prev.slice(0, -2)); // Remove failed interaction
        } finally {
            setIsChatLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleSendMessage(chatInput);
        setChatInput('');
    };

    return (
        <div className="flex flex-col h-[400px] bg-brand-bg border border-brand-primary rounded-lg overflow-hidden shadow-xl animate-fade-in">
            <div className="flex items-center justify-between p-3 border-b border-brand-primary bg-brand-surface">
                <div className="flex items-center gap-2">
                    <BotIcon className="text-brand-secondary" />
                    <span className="font-semibold text-brand-text">Gemini Assistant</span>
                </div>
                {onClose && (
                    <button onClick={onClose} className="text-brand-subtle hover:text-white transition-colors" aria-label="Close chat" title="Close chat">
                        <XCircleIcon />
                    </button>
                )}
            </div>
            
            <div ref={chatContainerRef} className="flex-grow p-4 space-y-4 overflow-y-auto bg-black/20">
                {chatHistory.length === 0 && !isChatLoading && (
                    <div className="text-center text-brand-subtle mt-10">
                        <p>Ask me anything about this endpoint!</p>
                        <p className="text-xs mt-2">I have context about the request parameters and code.</p>
                    </div>
                )}
                {chatHistory.map((msg, index) => (
                    <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                        {msg.role === 'model' && (
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-secondary/20 flex items-center justify-center border border-brand-secondary/30">
                                <BotIcon className="w-5 h-5 text-brand-secondary" />
                            </div>
                        )}
                        <div className={`max-w-[85%] p-3 rounded-lg text-sm ${
                            msg.role === 'user' 
                                ? 'bg-brand-secondary/20 text-white border border-brand-secondary/30' 
                                : 'bg-brand-surface text-brand-text border border-brand-primary'
                        }`}>
                            <pre className="whitespace-pre-wrap font-sans break-words">{msg.text}</pre>
                        </div>
                        {msg.role === 'user' && (
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center">
                                <UserIcon className="w-5 h-5 text-brand-subtle" />
                            </div>
                        )}
                    </div>
                ))}
                {isChatLoading && chatHistory[chatHistory.length - 1]?.role === 'user' && (
                    <div className="flex items-start gap-3">
                         <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-secondary/20 flex items-center justify-center border border-brand-secondary/30">
                            <BotIcon className="w-5 h-5 text-brand-secondary" />
                        </div>
                        <div className="p-3 rounded-lg bg-brand-surface border border-brand-primary flex items-center gap-2">
                            <SpinnerIcon />
                            <span className="text-xs text-brand-subtle">Thinking...</span>
                        </div>
                    </div>
                )}
                {chatError && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center">
                        {chatError}
                    </div>
                )}
            </div>

            <div className="p-3 border-t border-brand-primary bg-brand-surface">
                <form onSubmit={handleSubmit} className="flex items-center gap-2">
                    <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Type your message..."
                        className="flex-grow p-2 bg-brand-bg border border-brand-primary rounded-md focus:outline-none focus:ring-1 focus:ring-brand-secondary text-sm text-brand-text placeholder-brand-subtle"
                        disabled={isChatLoading}
                    />
                    <button
                        type="submit"
                        disabled={!chatInput.trim() || isChatLoading}
                        className="p-2 bg-brand-secondary text-white rounded-md hover:bg-brand-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isChatLoading ? <SpinnerIcon /> : <SendIcon />}
                    </button>
                </form>
            </div>
        </div>
    );
};
