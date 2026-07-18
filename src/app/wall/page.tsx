import WallSessionApp from "@/components/wall/wall-session-app";
import { loadInitialData } from "@/lib/history-wall/load-seed";

export default function WallPage() {
  return <WallSessionApp data={loadInitialData()} />;
}
