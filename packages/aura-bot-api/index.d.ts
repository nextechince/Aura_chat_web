/**
 * aura-bot-api — TypeScript definitions
 * @version 0.1.0
 */

export interface BotProfile {
  id: string;
  username: string;
  name: string;
  about: string;
  avatar_url: string | null;
  commands: string[];
}

export interface Message {
  message_id: string;
  from: { id: string; name: string };
  chat: { id: string; type: string };
  text: string | null;
  media_type: string | null;
  media_url: string | null;
  date: number;
}

export interface Update {
  update_id: string;
  message: Message;
}

export interface AuraBotOptions {
  baseURL?: string;
  pollInterval?: number;
  debug?: boolean;
}

export interface SendMessageOptions {
  parseMode?: 'Markdown' | 'HTML';
}

export interface SendPhotoOptions {
  caption?: string;
}

export class AuraBotError extends Error {
  code: string;
  status: number;
}

declare class AuraBot {
  constructor(token: string, options?: AuraBotOptions);

  readonly token: string;
  readonly baseURL: string;
  readonly pollInterval: number;
  readonly version: string;

  getMe(): Promise<BotProfile>;
  sendMessage(chatId: string, text: string, options?: SendMessageOptions): Promise<{ message_id: string }>;
  sendPhoto(chatId: string, photoUrl: string, options?: SendPhotoOptions): Promise<{ message_id: string }>;
  setWebhook(url: string): Promise<boolean>;
  deleteWebhook(): Promise<boolean>;
  getUpdates(offset?: number): Promise<Update[]>;

  start(options?: { pollInterval?: number }): this;
  stop(): this;

  on(event: 'message', listener: (msg: Message) => void): this;
  on(event: 'update', listener: (u: Update) => void): this;
  on(event: 'error', listener: (e: Error) => void): this;
}

export default AuraBot;
export { AuraBot };
