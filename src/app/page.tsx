import HistoryWallApp from "@/components/history-wall/history-wall-app";
import { loadInitialData } from "@/lib/history-wall/load-seed";

const historyWall = loadInitialData();

export default function Home() {
  return <HistoryWallApp initialData={historyWall} />;
}
