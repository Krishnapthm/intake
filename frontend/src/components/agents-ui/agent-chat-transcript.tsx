'use client';;
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import { AgentChatIndicator } from '@/components/agents-ui/agent-chat-indicator';
import { AnimatePresence } from 'motion/react';
import type { ComponentProps } from 'react';
import type { VisualizerState } from '@/types/intake';

type ChatMessage = {
  id: string;
  timestamp: string | number | Date;
  from?: {
    isLocal?: boolean;
  };
  message: string;
};

/**
 * A chat transcript component that displays a conversation between the user and agent.
 * Shows messages with timestamps and origin indicators, plus a thinking indicator
 * when the agent is processing.
 *
 * @extends ComponentProps<'div'>
 *
 * @example
 * ```tsx
 * <AgentChatTranscript
 *   agentState={agentState}
 *   messages={chatMessages}
 * />
 * ```
 */
export function AgentChatTranscript({
  agentState,
  messages = [],
  className,
  ...props
}: ComponentProps<typeof Conversation> & {
  agentState?: VisualizerState;
  messages?: ChatMessage[];
}) {
  return (
    <Conversation className={className} {...props}>
      <ConversationContent>
        {messages.map((receivedMessage) => {
          const { id, timestamp, from, message } = receivedMessage;
          const time = new Date(timestamp);
          const messageOrigin = from?.isLocal ? 'user' : 'assistant';
          const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
          const title = time.toLocaleTimeString(locale, { timeStyle: 'full' });

          return (
            <Message key={id} title={title} from={messageOrigin}>
              <MessageContent>
                <MessageResponse>{message}</MessageResponse>
              </MessageContent>
            </Message>
          );
        })}
        <AnimatePresence>
          {agentState === 'thinking' && <AgentChatIndicator size="sm" />}
        </AnimatePresence>
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
