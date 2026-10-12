import type { TicketPriority, TicketStatus } from "@deskflow/shared";
import { Badge } from "@/components/ui/badge";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/tickets/labels";

const STATUS_VARIANTS = {
  OPEN: "default",
  PENDING: "secondary",
  RESOLVED: "outline",
  CLOSED: "ghost",
} as const satisfies Record<TicketStatus, string>;

const PRIORITY_VARIANTS = {
  LOW: "ghost",
  MEDIUM: "outline",
  HIGH: "secondary",
  URGENT: "destructive",
} as const satisfies Record<TicketPriority, string>;

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>;
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return <Badge variant={PRIORITY_VARIANTS[priority]}>{PRIORITY_LABELS[priority]}</Badge>;
}
