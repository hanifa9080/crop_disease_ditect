import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Bot, Loader2, ExternalLink, Image as ImageIcon, Trash2, Maximize2, Minimize2 } from 'lucide-react';
import { chatWithBot, fetchChatHistory, deleteChatHistory } from '../services/backendService';
import { ChatMessage } from '../types';
import { useAuth } from '../contexts/AuthContext';

const SESSION_STORAGE_KEY = 'uzhavan_chat_session_id';

export const ChatInterface: React.FC = () => {
  const { user } = useAuth();  // null if not logged in
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // sessionId persists in localStorage so it survives page refresh.
  const [sessionId, setSessionId] = useState<string>(() => {
    const saved = localStorage.getItem(SESSION_STORAGE_KEY);
    if (saved) return saved;
    const newId = crypto.randomUUID();
    localStorage.setItem(SESSION_STORAGE_KEY, newId);
    return newId;
  });

  const chatReadyRef = useRef<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const WELCOME_MESSAGE: ChatMessage = {
    id: 'init',
    role: 'model',
    text: "Hi! I'm your plant expert assistant. Ask me anything about plant care, pests, or gardening tips! 🌱",
    timestamp: Date.now()
  };

  // Load history from DB on first open, or show welcome if no history exists.
  const initSession = useCallback(async () => {
    if (chatReadyRef.current) return;
    chatReadyRef.current = true;

    // Guests (not logged in) get a fresh chat every time — no history to load
    if (!user) {
      setMessages([WELCOME_MESSAGE]);
      return;
    }

    setIsLoadingHistory(true);
    try {
      const dbMessages = await fetchChatHistory(sessionId);

      if (dbMessages.length === 0) {
        // No history found for this session — fresh start
        setMessages([WELCOME_MESSAGE]);
      } else {
        // Reconstruct ChatMessage[] from DB rows
        const restored: ChatMessage[] = dbMessages.map((m, idx) => ({
          id: `restored-${idx}`,
          role: m.role as 'user' | 'model',
          text: m.content,
          timestamp: m.timestamp,
        }));
        // Insert welcome message at position 0 so UI looks right
        setMessages([WELCOME_MESSAGE, ...restored]);
      }
    } catch {
      setMessages([WELCOME_MESSAGE]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [user, sessionId]);

  // Trigger session init when chat opens
  useEffect(() => {
    if (isOpen) {
      initSession();
    }
  }, [isOpen, initSession]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  // Clear chat: wipe DB, reset sessionId in localStorage, reset UI
  const handleClearChat = useCallback(async () => {
    // 1. Wipe from database (best-effort)
    if (user) {
      deleteChatHistory(sessionId);  // fire-and-forget
    }

    // 2. Generate new session, persist to localStorage
    const newSessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_STORAGE_KEY, newSessionId);
    setSessionId(newSessionId);

    // 3. Reset UI state
    chatReadyRef.current = false;
    setMessages([]);

    // 4. Re-init (shows welcome message, no history to load for new session)
    setTimeout(() => {
      chatReadyRef.current = true;
      setMessages([{ ...WELCOME_MESSAGE, id: crypto.randomUUID(), timestamp: Date.now() }]);
    }, 50);
  }, [user, sessionId]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        alert("Please select an image file.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAttachedImage(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
    // Reset input so same file can be selected again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveImage = () => {
    setAttachedImage(null);
  };

  const handleSend = async () => {
    if (!input.trim() && !attachedImage) return;
    if (!chatReadyRef.current) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: input,
      attachment: attachedImage || undefined,
      timestamp: Date.now()
    };

    // Snapshot BEFORE state update — avoids stale closure issue
    const currentMessages = messages;

    setMessages(prev => [...prev, userMsg]);
    const messageToSend = input;
    setInput('');
    setAttachedImage(null);
    setIsLoading(true);

    try {
      // Build history from all real messages (skip the welcome message)
      const history = currentMessages
        .filter(m => m.id !== 'init')
        .filter(m => m.text.trim().length > 0)
        .map(m => ({
          role: m.role as 'user' | 'model',
          content: m.text,
        }));

      const responseText = await chatWithBot(messageToSend, history, sessionId);

      const botMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'model',
        text: responseText,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'model',
        text: "I'm having trouble connecting right now. Please try again.",
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-[60] p-4 rounded-full shadow-2xl transition-all duration-300 ${isOpen ? 'bg-gray-800 text-white rotate-90' : 'bg-emerald-600 text-white hover:bg-emerald-700 hover:scale-105'}`}
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className={`fixed z-50 bg-white shadow-2xl flex flex-col border border-emerald-50 overflow-hidden transition-all duration-300 origin-bottom-right ${isMaximized
          ? 'bottom-0 right-0 w-full h-full md:w-[90vw] md:h-[90vh] md:bottom-6 md:right-6 md:rounded-3xl rounded-none'
          : 'bottom-24 right-6 w-[90vw] md:w-[400px] h-[60vh] max-h-[600px] rounded-3xl'
          }`}>

          {/* Header */}
          <div className="bg-emerald-600 p-4 flex items-center justify-between gap-3 text-white cursor-pointer" onDoubleClick={() => setIsMaximized(!isMaximized)}>
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-full">
                <Bot size={20} />
              </div>
              <div>
                <h3 className="font-bold">Plant Assistant</h3>
                <p className="text-xs text-emerald-100 flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-300 rounded-full animate-pulse" />
                  {isLoadingHistory ? 'Loading your chat...' : 'Online • Local AI'}
                  {!isLoadingHistory && messages.filter(m => m.id !== 'init').length > 0 && (
                    <span className="ml-1 opacity-75">
                      • {Math.floor(messages.filter(m => m.id !== 'init').length / 2)} turns
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Window Controls */}
            <div className="flex items-center gap-1">
              {/* Clear button — only shown when there are real messages */}
              {messages.filter(m => m.id !== 'init').length > 0 && (
                <button
                  onClick={handleClearChat}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                  title="Clear chat history"
                  disabled={isLoading}
                >
                  <Trash2 size={16} />
                </button>
              )}
              <button
                onClick={() => setIsMaximized(!isMaximized)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                title={isMaximized ? "Restore" : "Maximize"}
              >
                {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {/* History loading indicator */}
            {isLoadingHistory && (
              <div className="flex justify-center py-4">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Loader2 size={14} className="animate-spin text-emerald-500" />
                  Restoring your conversation...
                </div>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-3 ${msg.role === 'user'
                  ? 'bg-emerald-600 text-white rounded-tr-none'
                  : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-tl-none'
                  }`}>

                  {msg.attachment && (
                    <div className="mb-2 rounded-lg overflow-hidden border border-white/20">
                      <img src={msg.attachment} alt="User attachment" className="max-w-full max-h-48 object-cover" />
                    </div>
                  )}

                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>

                  {/* Sources (kept for backward compatibility with history) */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 mb-2">Sources:</p>
                      <div className="flex flex-wrap gap-2">
                        {msg.sources.map((source, idx) => (
                          <a
                            key={idx}
                            href={source.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                          >
                            <ExternalLink size={10} />
                            <span className="truncate max-w-[150px]">{source.title}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <span className={`text-[10px] block mt-1 opacity-70 ${msg.role === 'user' ? 'text-emerald-100' : 'text-gray-400'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm border border-gray-100 flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-emerald-500" />
                  <span className="text-xs text-gray-400">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="bg-white border-t border-gray-100">
            {/* Attachment Preview */}
            {attachedImage && (
              <div className="px-3 pt-3 flex items-center gap-2 animate-fade-in">
                <div className="relative group">
                  <img src={attachedImage} alt="Preview" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                  <button
                    onClick={handleRemoveImage}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-md hover:bg-red-600 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
                <span className="text-xs text-gray-500">Image attached</span>
              </div>
            )}

            <div className="p-3">
              <div className="flex gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageSelect}
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-gray-100 text-gray-500 p-3 rounded-full hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                  title="Attach image"
                  disabled={isLoading}
                >
                  <ImageIcon size={18} />
                </button>

                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={attachedImage ? "Ask about this image..." : "Ask about plant care..."}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSend}
                  disabled={(!input.trim() && !attachedImage) || isLoading}
                  className="bg-emerald-600 text-white p-3 rounded-full hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-emerald-200"
                >
                  <Send size={18} />
                </button>
              </div>
              <p className="text-[10px] text-center text-gray-400 mt-2">
                AI can make mistakes. Check important info.
              </p>
            </div>
          </div>

        </div>
      )}
    </>
  );
};