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
    <div className="relative flex h-[calc(100vh-120px)] bg-[#111111] overflow-hidden">
      {/* Ambient Glows */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* LEFT PANE: Thread List (30%) */}
      <div className="relative z-10 flex w-[30%] flex-col bg-white/[0.02]">
        {/* Header */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold tracking-tight text-white">Messages</h2>
            <button
              onClick={() => setIsNewChatModalOpen(true)}
              className="rounded-full bg-emerald-500 p-2 text-black transition-all duration-300 hover:bg-emerald-400"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher..."
              className="w-full rounded-xl border-[0.5px] border-white/[0.08] bg-white/[0.03] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none transition-all duration-300"
            />
          </div>
        </div>

        {/* Thread List */}
        <div className="flex-1 overflow-y-auto px-3 space-y-1">
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
                    'w-full p-4 rounded-xl text-left transition-all duration-300',
                    isActive
                      ? 'bg-emerald-500/10 border-[0.5px] border-emerald-500/20'
                      : 'hover:bg-white/[0.04] border-[0.5px] border-transparent'
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                      <span className="text-base font-bold text-emerald-400">
                        {contact.name.charAt(0)}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-white text-sm truncate">
                          {contact.name}
                        </h3>
                        {thread.messages.length > 0 && (
                          <span className="text-[11px] text-white/30 font-medium">
                            {formatTime(thread.messages[thread.messages.length - 1].timestamp)}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="text-xs text-white/40 truncate">
                          {thread.lastMessage || 'Nouvelle conversation'}
                        </p>
                        {thread.unreadCount > 0 && (
                          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-black">
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
              <MessageSquare className="mx-auto h-12 w-12 text-white/10" />
              <p className="mt-4 text-sm font-medium text-white/40">Aucune conversation</p>
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="w-[1px] bg-white/[0.06]" />

      {/* RIGHT PANE: Chat Window (70%) */}
      <div className="relative z-10 flex w-[70%] flex-col">
        {selectedThread && selectedContact ? (
          <>
            {/* Chat Header */}
            <div className="bg-white/[0.03] backdrop-blur-[16px] border-b border-white/5 px-8 py-4">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                  <span className="text-sm font-bold text-emerald-400">
                    {selectedContact.name.charAt(0)}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1">
                  <h3 className="font-semibold text-white text-sm">{selectedContact.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"></div>
                    <span className="text-xs text-white/40">{selectedContact.role}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-8 space-y-4">
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
                        'max-w-[70%] px-5 py-3',
                        message.sender === 'me'
                          ? 'bg-emerald-500 text-black rounded-2xl rounded-br-sm'
                          : 'bg-white/[0.03] backdrop-blur-[16px] border-[0.5px] border-white/[0.08] text-white rounded-2xl rounded-bl-sm'
                      )}
                    >
                      <p className="text-sm leading-relaxed">{message.text}</p>
                      <p
                        className={cn(
                          'mt-1.5 text-[11px]',
                          message.sender === 'me' ? 'text-black/50' : 'text-white/30'
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
                    <MessageSquare className="mx-auto h-12 w-12 text-white/10" />
                    <p className="mt-4 text-sm font-medium text-white/40">
                      Commencez une conversation
                    </p>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Message Input — Glass Card */}
            <div className="m-4 rounded-2xl border-[0.5px] border-white/[0.08] bg-white/[0.03] backdrop-blur-[16px] p-4 shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
              <div className="flex items-center gap-3">
                {/* Attachment Button */}
                <button className="rounded-full p-2.5 text-white/40 transition-all duration-300 hover:bg-white/[0.04] hover:text-white">
                  <Paperclip className="h-5 w-5" />
                </button>

                {/* Input */}
                <input
                  ref={inputRef}
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ecrivez votre message..."
                  className="flex-1 bg-transparent px-2 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none"
                />

                {/* Send Button */}
                <button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                  className="rounded-full bg-emerald-500 p-2.5 text-black transition-all duration-300 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/[0.03] border-[0.5px] border-white/[0.08]">
                <MessageSquare className="h-10 w-10 text-white/10" />
              </div>
              <h3 className="text-lg font-extrabold tracking-tight text-white">
                Selectionnez une conversation
              </h3>
              <p className="mt-2 text-sm text-white/40">
                Choisissez un contact pour commencer a discuter
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
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={() => setIsNewChatModalOpen(false)}
          />

          {/* Modal */}
          <div className="relative w-full max-w-md rounded-2xl border-[0.5px] border-white/[0.08] bg-white/[0.03] backdrop-blur-[16px] shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
            {/* Header */}
            <div className="bg-white/5 px-8 py-4 border-b border-white/5 flex items-start justify-between">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-white/60">Nouvelle conversation</h2>
                <p className="mt-1 text-xs text-white/30">Selectionnez un contact</p>
              </div>
              <button
                onClick={() => setIsNewChatModalOpen(false)}
                className="rounded-full p-2 text-white/40 hover:bg-white/[0.04] hover:text-white transition-all duration-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search */}
            <div className="px-8 pt-6 pb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  value={newChatSearch}
                  onChange={(e) => setNewChatSearch(e.target.value)}
                  placeholder="Rechercher un contact..."
                  className="w-full rounded-xl border-[0.5px] border-white/[0.08] bg-white/[0.03] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none transition-all duration-300"
                />
              </div>
            </div>

            {/* Contact List */}
            <div className="max-h-96 overflow-y-auto px-8 pb-8">
              <div className="space-y-2">
                {availableContacts.length > 0 ? (
                  availableContacts.map((contact) => (
                    <button
                      key={contact.id}
                      onClick={() => handleNewChat(contact.id)}
                      className="w-full rounded-xl bg-white/[0.02] border-[0.5px] border-white/[0.08] p-4 text-left transition-all duration-300 hover:border-emerald-500/30 hover:bg-white/[0.04]"
                    >
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                          <span className="text-sm font-bold text-emerald-400">
                            {contact.name.charAt(0)}
                          </span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-white text-sm">{contact.name}</h3>
                          <p className="text-xs text-white/40 truncate">{contact.role}</p>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="py-8 text-center text-sm text-white/40">Aucun contact trouve</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
