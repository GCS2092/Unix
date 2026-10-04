import { Link } from "react-router-dom"
import { useNotifications } from "../lib/useNotifications"

export default function NotificationBell({ className = "" }: { className?: string }) {
  const { unread } = useNotifications()
  return (
    <Link
      to="/etudiant/notifications"
      className={`relative inline-flex items-center gap-1.5 ${className}`}
      aria-label={unread > 0 ? `Notifications (${unread} non lues)` : "Notifications"}
    >
      <span aria-hidden="true">&#128276;</span>
      <span>Notifications</span>
      {unread > 0 && (
        <span className="rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">{unread}</span>
      )}
    </Link>
  )
}