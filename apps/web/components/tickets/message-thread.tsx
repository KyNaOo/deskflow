import { RelativeTime } from "@/components/relative-time";
import type { Message } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/** Conversation : les notes internes (agents seulement) sont nettement distinguées des réponses. */
export function MessageThread({ messages }: { messages: Message[] }) {
  return (
    <ol className="flex flex-col gap-4">
      {messages.map((message) => {
        const fromCustomer = message.author.role === "CUSTOMER";
        return (
          <li
            key={message.id}
            className={cn(
              "rounded-lg border p-4",
              message.isInternalNote && "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950",
              !message.isInternalNote && !fromCustomer && "bg-muted/50",
            )}
          >
            <div className="mb-2 flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="font-medium">{message.author.name}</span>
              <span className="text-muted-foreground">{fromCustomer ? "Client" : "Équipe"}</span>
              {message.isInternalNote && (
                <span className="font-medium text-amber-800 dark:text-amber-300">· Note interne</span>
              )}
              <span className="ml-auto text-muted-foreground">
                <RelativeTime date={message.createdAt} />
              </span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{message.body}</p>
          </li>
        );
      })}
    </ol>
  );
}
