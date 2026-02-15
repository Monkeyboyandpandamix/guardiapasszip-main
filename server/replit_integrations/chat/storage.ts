interface Conversation {
  id: number;
  title: string;
  createdAt: Date;
}

interface Message {
  id: number;
  conversationId: number;
  role: string;
  content: string;
  createdAt: Date;
}

export interface IChatStorage {
  getConversation(id: number): Promise<Conversation | undefined>;
  getAllConversations(): Promise<Conversation[]>;
  createConversation(title: string): Promise<Conversation>;
  deleteConversation(id: number): Promise<void>;
  getMessagesByConversation(conversationId: number): Promise<Message[]>;
  createMessage(conversationId: number, role: string, content: string): Promise<Message>;
}

const conversationsStore = new Map<number, Conversation>();
const messagesStore = new Map<number, Message>();
let conversationIdCounter = 1;
let messageIdCounter = 1;

export const chatStorage: IChatStorage = {
  async getConversation(id: number) {
    return conversationsStore.get(id);
  },

  async getAllConversations() {
    return [...conversationsStore.values()].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  },

  async createConversation(title: string) {
    const conversation: Conversation = {
      id: conversationIdCounter++,
      title,
      createdAt: new Date(),
    };
    conversationsStore.set(conversation.id, conversation);
    return conversation;
  },

  async deleteConversation(id: number) {
    conversationsStore.delete(id);
    for (const [messageId, message] of messagesStore.entries()) {
      if (message.conversationId === id) {
        messagesStore.delete(messageId);
      }
    }
  },

  async getMessagesByConversation(conversationId: number) {
    return [...messagesStore.values()]
      .filter((message) => message.conversationId === conversationId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  },

  async createMessage(conversationId: number, role: string, content: string) {
    const message: Message = {
      id: messageIdCounter++,
      conversationId,
      role,
      content,
      createdAt: new Date(),
    };
    messagesStore.set(message.id, message);
    return message;
  },
};
