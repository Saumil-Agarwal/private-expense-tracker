import Link from "next/link";
import { CirclePlus, History, LayoutDashboard, Users } from "lucide-react";

export function AppNav() {
  return <nav className="app-nav"><Link href="/summary"><LayoutDashboard size={18} />Overview</Link><Link href="/expenses"><History size={18} />Expenses</Link><Link href="/groups"><Users size={18} />Groups</Link><Link className="nav-add" href="/expenses/new"><CirclePlus size={19} />Add</Link></nav>;
}
