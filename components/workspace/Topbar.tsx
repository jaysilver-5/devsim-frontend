"use client";

type Props = {
  session: any;
};

export default function Topbar({ session }: Props) {
  const currentTicket = session?.simulation?.tickets?.find(
    (ticket: any) => ticket.sequence === session?.currentTicketSeq
  );

  return (
    <div className="ide-topbar flex h-11 items-center gap-3 border-b px-3 text-xs">
      <div className="min-w-0">
        <div className="truncate font-medium text-white">
          {session?.simulation?.title ?? "Workspace"}
        </div>
        <div className="truncate ide-muted text-[11px]">
          Ticket {session?.currentTicketSeq ?? "-"} · {currentTicket?.title ?? "No active task"}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="rounded border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] ide-soft">
          {session?.simulation?.stack ?? "Unknown stack"}
        </div>
        <div className="rounded border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] ide-soft">
          Session {session?.id?.slice?.(0, 8) ?? "—"}
        </div>
      </div>
    </div>
  );
}