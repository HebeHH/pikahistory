import baseHistoryWallData from "../../public/data/history-wall.base.json";

import { parseHistoryWallData } from "@/contracts/history-wall.schema";
import HistoryWallApp from "@/components/history-wall/history-wall-app";

const historyWall = parseHistoryWallData(baseHistoryWallData);

export default function Home() {
  return <HistoryWallApp initialData={historyWall} />;
}
