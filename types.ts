
export enum AppView {
  Story = 'STORY',
  Chat = 'CHAT',
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
