import { useState, useEffect, useRef } from 'react'
import {
  Search,
  Plus,
  Send,
  Paperclip,
  X,
  MessageSquare,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useMessages } from '../contexts/MessagesContext'
import { useInternalContacts } from '../contexts/InternalContactsContext'

export function MessagesPage() {
  const { threads, sendMessage, createThread, markAsRead } = useMessages()
  const { contacts } = useInternalContacts()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [messageInput, setMessageInput] = useState('')
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false)
  const [newChatSearch, setNewChatSearch] = useState('')

  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Get selected thread
  const selectedThread = threads.find((t) => t.id === selectedThreadId)

  // Get contact info for selected thread
  const selectedContact = selectedThread
    ? contacts.find((c) => c.id === selectedThread.contactId)
    : null

  // Filter threads by search query
  const filteredThreads = threads.filter((thread) => {
    const contact = contacts.find((c) => c.id === thread.contactId)
    if (!contact) return false
    return contact.name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  // Filter contacts for new chat modal
  const availableContacts = contacts.filter((contact) =>
    contact.name.toLowerCase().includes(newChatSearch.toLowerCase())
  )

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [selectedThread?.messages])

  // Mark as read when selecting a thread
  useEffect(() => {
    if (selectedThreadId) {
      markAsRead(selectedThreadId)
    }
  }, [selectedThreadId, markAsRead])

  // Focus input when thread is selected
  useEffect(() => {
    if (selectedThreadId && inputRef.current) {
      inputRef.current.focus()
    }
  }, [selectedThreadId])

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedThreadId) return

    sendMessage(selectedThreadId, messageInput.trim())
    setMessageInput('')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleNewChat = (contactId: number) => {
    const threadId = createThread(contactId)
    setSelectedThreadId(threadId)
    setIsNewChatModalOpen(false)
    setNewChatSearch('')
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'À l\'instant'
    if (diffMins < 60) return `${diffMins}m`
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays === 1) return 'Hier'
    if (diffDays < 7) return `${diffDays}j`
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex h-[calc(100vh-120px)] bg-slate-950">
      {/* LEFT PANE: Thread List (30%) */}
      <div className="flex w-[30%] flex-col border-r border-slate-800 bg-slate-900">
        {/* Header */}
        <div className="border-b border-slate-800 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Messages</h2>
            <button
              onClick={() => setIsNewChatModalOpen(true)}
              className="rounded-lg bg-blue-500 p-2 transition-all hover:bg-blue-600"
            >
              <Plus className="h-5 w-5 text-white" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher..."
              className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Thread List */}
        <div className="flex-1 overflow-y-auto">
          {filteredThreads.length > 0 ? (
            filteredThreads.map((thread) => {
              const contact = contacts.find((c) => c.id === thread.contactId)
              if (!contact) return null

              const isActive = selectedThreadId === thread.id

              return (
                <button
                  key={thread.id}
                  onClick={() => setSelectedThreadId(thread.id)}
                  className={cn(
                    'w-full border-b border-slate-800 p-4 text-left transition-all',
                    isActive
                      ? 'bg-blue-500/10 border-l-4 border-l-blue-500'
                      : 'hover:bg-slate-800/50'
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20">
                      <span className="text-lg font-bold text-blue-400">
                        {contact.name.charAt(0)}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-white truncate">
                          {contact.name}
                        </h3>
                        {thread.messages.length > 0 && (
                          <span className="text-xs text-slate-500">
                            {formatTime(thread.messages[thread.messages.length - 1].timestamp)}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="text-sm text-slate-400 truncate">
                          {thread.lastMessage || 'Nouvelle conversation'}
                        </p>
                        {thread.unreadCount > 0 && (
                          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">
                            {thread.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })
          ) : (
            <div className="py-12 text-center">
              <MessageSquare className="mx-auto h-12 w-12 text-slate-700" />
              <p className="mt-4 text-sm font-medium text-slate-400">Aucune conversation</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANE: Chat Window (70%) */}
      <div className="flex w-[70%] flex-col bg-slate-950">
        {selectedThread && selectedContact ? (
          <>
            {/* Chat Header */}
            <div className="border-b border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20">
                  <span className="text-sm font-bold text-blue-400">
                    {selectedContact.name.charAt(0)}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1">
                  <h3 className="font-semibold text-white">{selectedContact.name}</h3>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                    <span className="text-xs text-slate-400">{selectedContact.role}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {selectedThread.messages.length > 0 ? (
                selectedThread.messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex',
                      message.sender === 'me' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[70%] rounded-2xl px-4 py-3',
                        message.sender === 'me'
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                          : 'bg-slate-800 text-slate-100'
                      )}
                    >
                      <p className="text-sm leading-relaxed">{message.text}</p>
                      <p
                        className={cn(
                          'mt-1 text-xs',
                          message.sender === 'me' ? 'text-blue-100' : 'text-slate-500'
                        )}
                      >
                        {formatMessageTime(message.timestamp)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <MessageSquare className="mx-auto h-12 w-12 text-slate-700" />
                    <p className="mt-4 text-sm font-medium text-slate-400">
                      Commencez une conversation
                    </p>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Message Input */}
            <div className="border-t border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center gap-3">
                {/* Attachment Button (Visual only) */}
                <button className="rounded-lg p-2 text-slate-400 transition-all hover:bg-slate-800 hover:text-white">
                  <Paperclip className="h-5 w-5" />
                </button>

                {/* Input */}
                <input
                  ref={inputRef}
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Écrivez votre message..."
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />

                {/* Send Button */}
                <button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                  className="rounded-lg bg-blue-500 p-3 text-white transition-all hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <MessageSquare className="mx-auto h-16 w-16 text-slate-700" />
              <h3 className="mt-4 text-lg font-semibold text-white">
                Sélectionnez une conversation
              </h3>
              <p className="mt-2 text-sm text-slate-400">
                Choisissez un contact pour commencer à discuter
              </p>
            </div>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      {isNewChatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsNewChatModalOpen(false)}
          />

          {/* Modal */}
          <div className="relative w-full max-w-md rounded-xl bg-slate-900 shadow-2xl ring-1 ring-slate-800">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-800 p-6">
              <div>
                <h2 className="text-xl font-bold text-white">Nouvelle conversation</h2>
                <p className="mt-1 text-sm text-slate-400">Sélectionnez un contact</p>
              </div>
              <button
                onClick={() => setIsNewChatModalOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search */}
            <div className="p-6 pb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={newChatSearch}
                  onChange={(e) => setNewChatSearch(e.target.value)}
                  placeholder="Rechercher un contact..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Contact List */}
            <div className="max-h-96 overflow-y-auto px-6 pb-6">
              <div className="space-y-2">
                {availableContacts.length > 0 ? (
                  availableContacts.map((contact) => (
                    <button
                      key={contact.id}
                      onClick={() => handleNewChat(contact.id)}
                      className="w-full rounded-lg bg-slate-800/50 p-3 text-left transition-all hover:bg-slate-800"
                    >
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20">
                          <span className="text-sm font-bold text-blue-400">
                            {contact.name.charAt(0)}
                          </span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-white">{contact.name}</h3>
                          <p className="text-sm text-slate-400 truncate">{contact.role}</p>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="py-8 text-center text-sm text-slate-500">Aucun contact trouvé</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
