import { parseHistoryWallData } from "@/contracts/history-wall.schema";
import { TimelineWall } from "@/components/timeline/TimelineWall";

import baseHistoryWallData from "../../public/data/history-wall.base.json";

const historyWall = parseHistoryWallData(baseHistoryWallData);

export default function Home() {
  return <TimelineWall data={historyWall} />;
}
