import { AppNav } from "@/components/app-nav";
import { GroupManager } from "@/components/group-manager";

export default function GroupsPage() {
  return <main className="app-shell"><header className="app-header"><div><p className="eyebrow">Ledgerly</p><h1>Groups</h1></div></header><GroupManager /><AppNav /></main>;
}
